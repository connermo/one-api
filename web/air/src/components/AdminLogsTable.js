import React, { useEffect, useState } from 'react';
import { API, copy, isAdmin, showError, showSuccess, timestamp2string } from '../helpers';

import { Button, Form, Layout, Modal, Select, Space, Table, Tag } from '@douyinfe/semi-ui';
import { ITEMS_PER_PAGE } from '../constants';

const { Header } = Layout;

function renderTimestamp(timestamp) {
  return (<>
    {timestamp2string(timestamp)}
  </>);
}

function renderType(type) {
  const typeMap = {
    1: { text: '用户管理', color: 'blue' },
    2: { text: '渠道管理', color: 'orange' },
    3: { text: '系统配置', color: 'purple' },
    4: { text: '兑换码管理', color: 'green' },
    5: { text: '日志管理', color: 'cyan' }
  };
  
  const typeOption = typeMap[type];
  if (typeOption) {
    return <Tag color={typeOption.color} size="large">{typeOption.text}</Tag>;
  } else {
    return <Tag color="red" size="large">未知类型</Tag>;
  }
}

const AdminLogsTable = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState(1);
  const [logCount, setLogCount] = useState(ITEMS_PER_PAGE);
  const [pageSize, setPageSize] = useState(ITEMS_PER_PAGE);
  const [logType, setLogType] = useState(0);
  const [username, setUsername] = useState('');
  const isAdminUser = isAdmin();

  let now = new Date();
  const [start_timestamp, setStartTimestamp] = useState(timestamp2string(now.getTime() / 1000 - 86400));
  const [end_timestamp, setEndTimestamp] = useState(timestamp2string(now.getTime() / 1000 + 3600));

  const columns = [
    {
      title: '时间',
      dataIndex: 'created_at',
      render: (text, record, index) => {
        return (
          <div>
            {renderTimestamp(text)}
          </div>
        );
      },
    },
    {
      title: '操作员',
      dataIndex: 'username',
      render: (text, record, index) => {
        return (
          <div>
            <Tag color="blue" size="large">{text}</Tag>
          </div>
        );
      },
    },
    {
      title: '操作类型',
      dataIndex: 'type',
      render: (text, record, index) => {
        return (
          <div>
            {renderType(text)}
          </div>
        );
      },
    },
    {
      title: '目标用户',
      dataIndex: 'target_user',
      render: (text, record, index) => {
        return (
          <div>
            {text ? <Tag color="green" size="large">{text}</Tag> : '-'}
          </div>
        );
      },
    },
    {
      title: '操作内容',
      dataIndex: 'content',
      render: (text, record, index) => {
        return (
          <div style={{ maxWidth: 300, wordBreak: 'break-word' }}>
            {text}
          </div>
        );
      },
    }
  ];

  const setLogsFormat = (logs) => {
    for (let i = 0; i < logs.length; i++) {
      logs[i].timestamp2string = timestamp2string(logs[i].created_at);
      logs[i].key = '' + logs[i].id;
    }
    setLogs(logs);
    setLogCount(logs.length + ITEMS_PER_PAGE);
  };

  const loadLogs = async (startIdx, pageSize, logType = 0) => {
    setLoading(true);

    let localStartTimestamp = Date.parse(start_timestamp) / 1000;
    let localEndTimestamp = Date.parse(end_timestamp) / 1000;
    let url = `/api/log/admin/?p=${startIdx}&page_size=${pageSize}&type=${logType}&username=${username}&start_timestamp=${localStartTimestamp}&end_timestamp=${localEndTimestamp}`;
    
    const res = await API.get(url);
    const { success, message, data } = res.data;
    if (success) {
      if (startIdx === 0) {
        setLogsFormat(data);
      } else {
        let newLogs = [...logs];
        newLogs.splice(startIdx * pageSize, data.length, ...data);
        setLogsFormat(newLogs);
      }
    } else {
      showError(message);
    }
    setLoading(false);
  };

  const pageData = logs.slice((activePage - 1) * pageSize, activePage * pageSize);

  const handlePageChange = page => {
    setActivePage(page);
    if (page === Math.ceil(logs.length / pageSize) + 1) {
      loadLogs(page - 1, pageSize).then(r => {
      });
    }
  };

  const handlePageSizeChange = async (size) => {
    localStorage.setItem('page-size', size + '');
    setPageSize(size);
    setActivePage(1);
    loadLogs(0, size)
      .then()
      .catch((reason) => {
        showError(reason);
      });
  };

  const refresh = async (localLogType) => {
    setActivePage(1);
    await loadLogs(0, pageSize, localLogType);
  };

  useEffect(() => {
    const localPageSize = parseInt(localStorage.getItem('page-size')) || ITEMS_PER_PAGE;
    setPageSize(localPageSize);
    loadLogs(0, localPageSize)
      .then()
      .catch((reason) => {
        showError(reason);
      });
  }, []);

  // 权限检查
  if (!isAdminUser) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <h3>没有权限访问此页面</h3>
      </div>
    );
  }

  return (<>
    <Layout>
      <Header>
        <h3>管理员操作日志</h3>
      </Header>
      <Form layout='horizontal' style={{ marginTop: 10 }}>
        <>
          <Form.Input field="username" label="操作员" style={{ width: 176 }} value={username}
            placeholder="操作员用户名" name="username"
            onChange={value => setUsername(value)} />
          <Form.DatePicker field="start_timestamp" label="起始时间" style={{ width: 272 }}
            initValue={start_timestamp}
            value={start_timestamp} type="dateTime"
            name="start_timestamp"
            onChange={value => setStartTimestamp(value)} />
          <Form.DatePicker field="end_timestamp" fluid label="结束时间" style={{ width: 272 }}
            initValue={end_timestamp}
            value={end_timestamp} type="dateTime"
            name="end_timestamp"
            onChange={value => setEndTimestamp(value)} />
          <Form.Section>
            <Button label="查询" type="primary" htmlType="submit" className="btn-margin-right"
              onClick={() => refresh(logType)} loading={loading}>查询</Button>
          </Form.Section>
        </>
      </Form>
      <Table style={{ marginTop: 5 }} columns={columns} dataSource={pageData} pagination={{
        currentPage: activePage,
        pageSize: pageSize,
        total: logCount,
        pageSizeOpts: [10, 20, 50, 100],
        showSizeChanger: true,
        onPageSizeChange: (size) => {
          handlePageSizeChange(size).then();
        },
        onPageChange: handlePageChange
      }} loading={loading} />
      <Select defaultValue="0" style={{ width: 120 }} onChange={(value) => {
        setLogType(parseInt(value));
        refresh(parseInt(value)).then();
      }}>
        <Select.Option value="0">全部</Select.Option>
        <Select.Option value="1">用户管理</Select.Option>
        <Select.Option value="2">渠道管理</Select.Option>
        <Select.Option value="3">系统配置</Select.Option>
        <Select.Option value="4">兑换码管理</Select.Option>
        <Select.Option value="5">日志管理</Select.Option>
      </Select>
    </Layout>
  </>);
};

export default AdminLogsTable; 