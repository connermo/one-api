#!/usr/bin/env python3
"""
模型统计脚本 - 读取One-API数据库并统计模型调用次数和token消耗
支持MySQL、PostgreSQL、SQLite和OceanBase数据库
"""

import os
import sys
import argparse
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional
import pandas as pd

try:
    import pymysql
    import psycopg2
    import sqlite3
    from sqlalchemy import create_engine, text
    from sqlalchemy.exc import SQLAlchemyError
except ImportError as e:
    print(f"缺少必要的依赖包: {e}")
    print("请安装依赖: pip install pymysql psycopg2-binary pandas sqlalchemy openpyxl")
    sys.exit(1)


class ModelStatsAnalyzer:
    """模型统计分析器"""
    
    def __init__(self, db_url: str = None):
        """
        初始化分析器
        
        Args:
            db_url: 数据库连接URL，如果为None则从环境变量读取
        """
        self.db_url = db_url or self._get_db_url_from_env()
        self.engine = None
        self._connect()
    
    def _get_db_url_from_env(self) -> str:
        """从环境变量获取数据库连接URL"""
        # 优先使用LOG_SQL_DSN，如果没有则使用SQL_DSN
        dsn = os.getenv('LOG_SQL_DSN') or os.getenv('SQL_DSN')
        
        if dsn:
            if dsn.startswith('postgres://'):
                return dsn
            elif dsn.startswith('oceanbase://'):
                # 转换OceanBase URL为MySQL格式
                return dsn.replace('oceanbase://', 'mysql+pymysql://')
            elif '://' not in dsn:
                # 假设是MySQL DSN格式: user:password@host:port/database
                return f'mysql+pymysql://{dsn}'
            else:
                return dsn
        
        # 检查OceanBase环境变量
        ob_user = os.getenv('OCEANBASE_USER')
        ob_password = os.getenv('OCEANBASE_PASSWORD')
        ob_host = os.getenv('OCEANBASE_HOST')
        ob_port = os.getenv('OCEANBASE_PORT', '2881')
        ob_database = os.getenv('OCEANBASE_DATABASE')
        ob_tenant = os.getenv('OCEANBASE_TENANT')
        ob_cluster = os.getenv('OCEANBASE_CLUSTER')
        
        if all([ob_user, ob_password, ob_host, ob_database]):
            # 构建完整的用户名
            full_username = ob_user
            if ob_tenant:
                if ob_cluster:
                    full_username = f"{ob_user}@{ob_tenant}:{ob_cluster}"
                else:
                    full_username = f"{ob_user}@{ob_tenant}"
            
            return f'mysql+pymysql://{full_username}:{ob_password}@{ob_host}:{ob_port}/{ob_database}'
        
        # 默认使用SQLite
        sqlite_path = os.getenv('SQLITE_PATH', './one-api.db')
        return f'sqlite:///{sqlite_path}'
    
    def _connect(self):
        """连接数据库"""
        try:
            self.engine = create_engine(self.db_url)
            # 测试连接
            with self.engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            print(f"数据库连接成功: {self.db_url.split('://')[0]}")
        except SQLAlchemyError as e:
            print(f"数据库连接失败: {e}")
            sys.exit(1)
    
    def get_model_stats(self, 
                       start_date: str = None, 
                       end_date: str = None,
                       model_name: str = None,
                       username: str = None) -> pd.DataFrame:
        """
        获取模型统计数据
        
        Args:
            start_date: 开始日期 (YYYY-MM-DD)
            end_date: 结束日期 (YYYY-MM-DD)
            model_name: 特定模型名称
            username: 特定用户名
            
        Returns:
            包含统计数据的DataFrame
        """
        # 构建基础查询
        query = """
        SELECT 
            model_name,
            COUNT(*) as call_count,
            SUM(COALESCE(prompt_tokens, 0)) as total_prompt_tokens,
            SUM(COALESCE(completion_tokens, 0)) as total_completion_tokens,
            SUM(COALESCE(prompt_tokens, 0) + COALESCE(completion_tokens, 0)) as total_tokens,
            SUM(COALESCE(quota, 0)) as total_quota,
            AVG(COALESCE(elapsed_time, 0)) as avg_elapsed_time
        FROM logs 
        WHERE type = 2
        """
        
        params = {}
        
        # 添加时间范围过滤
        if start_date:
            start_timestamp = int(datetime.strptime(start_date, '%Y-%m-%d').timestamp())
            query += " AND created_at >= :start_timestamp"
            params['start_timestamp'] = start_timestamp
            
        if end_date:
            end_timestamp = int(datetime.strptime(end_date, '%Y-%m-%d').timestamp()) + 86399  # 加一天减1秒
            query += " AND created_at <= :end_timestamp"
            params['end_timestamp'] = end_timestamp
        
        # 添加模型过滤
        if model_name:
            query += " AND model_name = :model_name"
            params['model_name'] = model_name
            
        # 添加用户过滤
        if username:
            query += " AND username = :username"
            params['username'] = username
        
        query += """
        GROUP BY model_name 
        ORDER BY call_count DESC
        """
        
        try:
            with self.engine.connect() as conn:
                df = pd.read_sql(text(query), conn, params=params)
                return df
        except SQLAlchemyError as e:
            print(f"查询数据失败: {e}")
            return pd.DataFrame()
    
    def get_daily_stats(self, 
                       start_date: str = None, 
                       end_date: str = None,
                       model_name: str = None) -> pd.DataFrame:
        """
        获取按日期分组的统计数据
        
        Args:
            start_date: 开始日期 (YYYY-MM-DD)
            end_date: 结束日期 (YYYY-MM-DD)
            model_name: 特定模型名称
            
        Returns:
            包含按日期分组统计数据的DataFrame
        """
        # 根据数据库类型选择日期格式化函数
        if 'postgresql' in self.db_url or 'postgres' in self.db_url:
            date_format = "TO_CHAR(date_trunc('day', to_timestamp(created_at)), 'YYYY-MM-DD')"
        elif 'sqlite' in self.db_url:
            date_format = "strftime('%Y-%m-%d', datetime(created_at, 'unixepoch'))"
        else:  # MySQL/OceanBase
            date_format = "DATE_FORMAT(FROM_UNIXTIME(created_at), '%Y-%m-%d')"
        
        query = f"""
        SELECT 
            {date_format} as date,
            model_name,
            COUNT(*) as call_count,
            SUM(COALESCE(prompt_tokens, 0)) as total_prompt_tokens,
            SUM(COALESCE(completion_tokens, 0)) as total_completion_tokens,
            SUM(COALESCE(prompt_tokens, 0) + COALESCE(completion_tokens, 0)) as total_tokens,
            SUM(COALESCE(quota, 0)) as total_quota
        FROM logs 
        WHERE type = 2
        """
        
        params = {}
        
        # 添加时间范围过滤
        if start_date:
            start_timestamp = int(datetime.strptime(start_date, '%Y-%m-%d').timestamp())
            query += " AND created_at >= :start_timestamp"
            params['start_timestamp'] = start_timestamp
            
        if end_date:
            end_timestamp = int(datetime.strptime(end_date, '%Y-%m-%d').timestamp()) + 86399
            query += " AND created_at <= :end_timestamp"
            params['end_timestamp'] = end_timestamp
            
        # 添加模型过滤
        if model_name:
            query += " AND model_name = :model_name"
            params['model_name'] = model_name
        
        query += f"""
        GROUP BY {date_format}, model_name 
        ORDER BY date DESC, call_count DESC
        """
        
        try:
            with self.engine.connect() as conn:
                df = pd.read_sql(text(query), conn, params=params)
                return df
        except SQLAlchemyError as e:
            print(f"查询数据失败: {e}")
            return pd.DataFrame()
    
    def get_user_stats(self, 
                      start_date: str = None, 
                      end_date: str = None) -> pd.DataFrame:
        """
        获取用户统计数据
        
        Args:
            start_date: 开始日期 (YYYY-MM-DD)
            end_date: 结束日期 (YYYY-MM-DD)
            
        Returns:
            包含用户统计数据的DataFrame
        """
        query = """
        SELECT 
            username,
            COUNT(*) as call_count,
            COUNT(DISTINCT model_name) as unique_models,
            SUM(COALESCE(prompt_tokens, 0) + COALESCE(completion_tokens, 0)) as total_tokens,
            SUM(COALESCE(quota, 0)) as total_quota
        FROM logs 
        WHERE type = 2 AND username != ''
        """
        
        params = {}
        
        # 添加时间范围过滤
        if start_date:
            start_timestamp = int(datetime.strptime(start_date, '%Y-%m-%d').timestamp())
            query += " AND created_at >= :start_timestamp"
            params['start_timestamp'] = start_timestamp
            
        if end_date:
            end_timestamp = int(datetime.strptime(end_date, '%Y-%m-%d').timestamp()) + 86399
            query += " AND created_at <= :end_timestamp"
            params['end_timestamp'] = end_timestamp
        
        query += """
        GROUP BY username 
        ORDER BY call_count DESC
        """
        
        try:
            with self.engine.connect() as conn:
                df = pd.read_sql(text(query), conn, params=params)
                return df
        except SQLAlchemyError as e:
            print(f"查询数据失败: {e}")
            return pd.DataFrame()


def format_number(num):
    """格式化数字显示"""
    if num >= 1_000_000_000:
        return f"{num/1_000_000_000:.1f}B"
    elif num >= 1_000_000:
        return f"{num/1_000_000:.1f}M"
    elif num >= 1_000:
        return f"{num/1_000:.1f}K"
    else:
        return str(int(num))


def export_to_excel(dfs_dict: dict, filename: str):
    """导出多个DataFrame到Excel文件的不同工作表"""
    try:
        with pd.ExcelWriter(filename, engine='openpyxl') as writer:
            for sheet_name, df in dfs_dict.items():
                if not df.empty:
                    # 创建一个包含中文列名的DataFrame副本
                    df_export = df.copy()
                    
                    # 重命名列为中文
                    column_mapping = {
                        'model_name': '模型名称',
                        'call_count': '调用次数',
                        'total_prompt_tokens': 'Prompt Token',
                        'total_completion_tokens': 'Completion Token',
                        'total_tokens': '总Token数',
                        'total_quota': '消耗配额',
                        'avg_elapsed_time': '平均响应时间(ms)',
                        'date': '日期',
                        'username': '用户名',
                        'unique_models': '使用模型数'
                    }
                    
                    df_export = df_export.rename(columns=column_mapping)
                    df_export.to_excel(writer, sheet_name=sheet_name, index=False)
                    
                    # 获取工作表并调整列宽
                    worksheet = writer.sheets[sheet_name]
                    for column in worksheet.columns:
                        max_length = 0
                        column_letter = column[0].column_letter
                        for cell in column:
                            try:
                                if len(str(cell.value)) > max_length:
                                    max_length = len(str(cell.value))
                            except:
                                pass
                        adjusted_width = min(max_length + 2, 50)
                        worksheet.column_dimensions[column_letter].width = adjusted_width
        
        print(f"数据已导出到Excel文件: {filename}")
        return True
    except Exception as e:
        print(f"导出Excel文件失败: {e}")
        return False


def export_data(df: pd.DataFrame, filename: str, sheet_name: str = "Sheet1"):
    """导出数据到文件（支持CSV和Excel格式）"""
    if df.empty:
        print("没有数据可导出")
        return False
    
    try:
        if filename.lower().endswith('.xlsx'):
            # Excel格式
            export_to_excel({sheet_name: df}, filename)
        elif filename.lower().endswith('.csv'):
            # CSV格式
            df.to_csv(filename, index=False, encoding='utf-8-sig')
            print(f"数据已导出到CSV文件: {filename}")
        else:
            # 默认使用Excel格式
            if not filename.endswith('.xlsx'):
                filename += '.xlsx'
            export_to_excel({sheet_name: df}, filename)
        return True
    except Exception as e:
        print(f"导出文件失败: {e}")
        return False


def print_stats_table(df: pd.DataFrame, title: str):
    """打印统计表格"""
    if df.empty:
        print(f"\n{title}: 没有找到数据")
        return
    
    print(f"\n{title}")
    print("=" * 80)
    
    if 'model_name' in df.columns:
        for _, row in df.iterrows():
            print(f"模型: {row['model_name']}")
            print(f"  调用次数: {format_number(row['call_count'])}")
            if 'total_tokens' in row:
                print(f"  总Token数: {format_number(row['total_tokens'])}")
            if 'total_prompt_tokens' in row:
                print(f"  Prompt Token: {format_number(row['total_prompt_tokens'])}")
            if 'total_completion_tokens' in row:
                print(f"  Completion Token: {format_number(row['total_completion_tokens'])}")
            if 'total_quota' in row and row['total_quota'] > 0:
                print(f"  消耗配额: {format_number(row['total_quota'])}")
            if 'avg_elapsed_time' in row and row['avg_elapsed_time'] > 0:
                print(f"  平均响应时间: {row['avg_elapsed_time']:.2f}ms")
            print()
    elif 'username' in df.columns:
        for _, row in df.iterrows():
            print(f"用户: {row['username']}")
            print(f"  调用次数: {format_number(row['call_count'])}")
            print(f"  使用模型数: {row['unique_models']}")
            print(f"  总Token数: {format_number(row['total_tokens'])}")
            if row['total_quota'] > 0:
                print(f"  消耗配额: {format_number(row['total_quota'])}")
            print()


def main():
    parser = argparse.ArgumentParser(description='One-API 模型统计工具')
    parser.add_argument('--start-date', help='开始日期 (YYYY-MM-DD)')
    parser.add_argument('--end-date', help='结束日期 (YYYY-MM-DD)')
    parser.add_argument('--model', help='特定模型名称')
    parser.add_argument('--user', help='特定用户名')
    parser.add_argument('--daily', action='store_true', help='显示按日期分组的统计')
    parser.add_argument('--users', action='store_true', help='显示用户统计')
    parser.add_argument('--db-url', help='数据库连接URL')
    parser.add_argument('--export', help='导出文件路径（支持.csv和.xlsx格式）')
    parser.add_argument('--report', help='生成综合Excel报告文件路径')
    
    args = parser.parse_args()
    
    # 如果没有指定结束日期，默认为今天
    if args.start_date and not args.end_date:
        args.end_date = datetime.now().strftime('%Y-%m-%d')
    
    # 如果没有指定开始日期，默认为7天前
    if not args.start_date:
        start_date = datetime.now() - timedelta(days=7)
        args.start_date = start_date.strftime('%Y-%m-%d')
        if not args.end_date:
            args.end_date = datetime.now().strftime('%Y-%m-%d')
    
    try:
        analyzer = ModelStatsAnalyzer(args.db_url)
        
        print(f"统计时间范围: {args.start_date} 到 {args.end_date}")
        if args.model:
            print(f"模型过滤: {args.model}")
        if args.user:
            print(f"用户过滤: {args.user}")
        
        if args.daily:
            # 显示按日期分组的统计
            df = analyzer.get_daily_stats(args.start_date, args.end_date, args.model)
            print_stats_table(df, "按日期分组的模型统计")
            
            if args.export and not df.empty:
                # 根据原始文件扩展名确定导出格式
                if args.export.lower().endswith('.xlsx'):
                    export_file = args.export.replace('.xlsx', '_daily.xlsx')
                elif args.export.lower().endswith('.csv'):
                    export_file = args.export.replace('.csv', '_daily.csv')
                else:
                    export_file = args.export + '_daily.xlsx'
                export_data(df, export_file, "按日期统计")
                
        elif args.users:
            # 显示用户统计
            df = analyzer.get_user_stats(args.start_date, args.end_date)
            print_stats_table(df, "用户统计")
            
            if args.export and not df.empty:
                # 根据原始文件扩展名确定导出格式
                if args.export.lower().endswith('.xlsx'):
                    export_file = args.export.replace('.xlsx', '_users.xlsx')
                elif args.export.lower().endswith('.csv'):
                    export_file = args.export.replace('.csv', '_users.csv')
                else:
                    export_file = args.export + '_users.xlsx'
                export_data(df, export_file, "用户统计")
                
        else:
            # 显示模型统计
            df = analyzer.get_model_stats(args.start_date, args.end_date, args.model, args.user)
            print_stats_table(df, "模型统计")
            
            if args.export and not df.empty:
                export_data(df, args.export, "模型统计")
        
        # 生成综合报告
        if args.report:
            print("\n正在生成综合报告...")
            report_data = {}
            
            # 获取模型统计
            model_stats = analyzer.get_model_stats(args.start_date, args.end_date, args.model, args.user)
            if not model_stats.empty:
                report_data["模型统计"] = model_stats
            
            # 获取按日期分组的统计
            daily_stats = analyzer.get_daily_stats(args.start_date, args.end_date, args.model)
            if not daily_stats.empty:
                report_data["按日期统计"] = daily_stats
            
            # 获取用户统计（如果没有指定特定用户）
            if not args.user:
                user_stats = analyzer.get_user_stats(args.start_date, args.end_date)
                if not user_stats.empty:
                    report_data["用户统计"] = user_stats
            
            if report_data:
                # 确保文件扩展名为.xlsx
                report_file = args.report
                if not report_file.lower().endswith('.xlsx'):
                    report_file += '.xlsx'
                export_to_excel(report_data, report_file)
            else:
                print("没有数据可生成报告")
        
    except KeyboardInterrupt:
        print("\n操作被用户取消")
    except Exception as e:
        print(f"程序执行出错: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()