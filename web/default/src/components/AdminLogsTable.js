import React, { useEffect, useState } from 'react';
import {
  Header,
  Table,
  Button,
  Form,
  Pagination,
  Label,
  Segment,
  Select,
  Search,
} from 'semantic-ui-react';
import { API, copy, isAdmin, showError, showSuccess, timestamp2string } from '../helpers';
import { ITEMS_PER_PAGE } from '../constants';
import { useTranslation } from 'react-i18next';

function renderTimestamp(timestamp) {
  return (
    <>
      {timestamp2string(timestamp)}
    </>
  );
}

function renderContent(content) {
  return (
    <div style={{ 
      maxWidth: '300px', 
      wordWrap: 'break-word',
      fontSize: '0.9em'
    }}>
      {content}
    </div>
  );
}

const AdminLogsTable = () => {
  const { t } = useTranslation();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState(1);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searching, setSearching] = useState(false);
  const [actionType, setActionType] = useState('');
  const isAdminUser = isAdmin();
  
  let now = new Date();
  const [inputs, setInputs] = useState({
    username: '',
    start_timestamp: timestamp2string(now.getTime() / 1000 - 86400 * 7), // 默认显示最近7天
    end_timestamp: timestamp2string(now.getTime() / 1000 + 3600),
  });
  
  const {
    username,
    start_timestamp,
    end_timestamp,
  } = inputs;

  const ACTION_TYPE_OPTIONS = [
    { key: '', text: '全部操作', value: '' },
    { key: '创建用户', text: '创建用户', value: '创建用户' },
    { key: '更新用户', text: '更新用户', value: '更新用户' },
    { key: '删除用户', text: '删除用户', value: '删除用户' },
    { key: '管理用户', text: '管理用户', value: '管理用户' },
    { key: '管理员充值', text: '管理员充值', value: '管理员充值' },
    { key: '创建渠道', text: '创建渠道', value: '创建渠道' },
    { key: '更新渠道', text: '更新渠道', value: '更新渠道' },
    { key: '删除渠道', text: '删除渠道', value: '删除渠道' },
    { key: '更新系统配置', text: '更新系统配置', value: '更新系统配置' },
    { key: '创建兑换码', text: '创建兑换码', value: '创建兑换码' },
    { key: '删除兑换码', text: '删除兑换码', value: '删除兑换码' },
    { key: '删除历史日志', text: '删除历史日志', value: '删除历史日志' },
  ];

  const handleInputChange = (e, { name, value }) => {
    setInputs((inputs) => ({ ...inputs, [name]: value }));
  };

  const loadLogs = async (startIdx) => {
    setLoading(true);
    let localStartTimestamp = Date.parse(start_timestamp) / 1000;
    let localEndTimestamp = Date.parse(end_timestamp) / 1000;
    
    let url = `/api/log/admin?p=${startIdx}&start_timestamp=${localStartTimestamp}&end_timestamp=${localEndTimestamp}`;
    if (username) url += `&username=${username}`;
    if (actionType) url += `&action_type=${actionType}`;
    
    const res = await API.get(url);
    const { success, message, data } = res.data;
    if (success) {
      if (startIdx === 0) {
        setLogs(data);
      } else {
        let newLogs = [...logs];
        newLogs.splice(startIdx * ITEMS_PER_PAGE, data.length, ...data);
        setLogs(newLogs);
      }
    } else {
      showError(message);
    }
    setLoading(false);
  };

  const onPaginationChange = (e, { activePage }) => {
    (async () => {
      if (activePage === Math.ceil(logs.length / ITEMS_PER_PAGE) + 1) {
        await loadLogs(activePage - 1);
      }
      setActivePage(activePage);
    })();
  };

  const refresh = async () => {
    setLoading(true);
    setActivePage(1);
    await loadLogs(0);
  };

  useEffect(() => {
    refresh().then();
  }, []);

  const searchLogs = async () => {
    if (searchKeyword === '') {
      await loadLogs(0);
      setActivePage(1);
      return;
    }
    setSearching(true);
    // 使用全局搜索，然后过滤管理日志
    const res = await API.get(`/api/log/search?keyword=${searchKeyword}`);
    const { success, message, data } = res.data;
    if (success) {
      // 过滤出管理员操作日志
      const adminLogs = data.filter(log => log.type === 3);
      setLogs(adminLogs);
      setActivePage(1);
    } else {
      showError(message);
    }
    setSearching(false);
  };

  const handleKeywordChange = async (e, { value }) => {
    setSearchKeyword(value.trim());
  };

  if (!isAdminUser) {
    return (
      <Segment>
        <Header as='h3'>访问被拒绝</Header>
        <p>您没有权限查看管理员操作日志。</p>
      </Segment>
    );
  }

  return (
    <>
      <Header as='h3'>
        管理员操作日志
        <Header.Subheader>
          查看和监控系统管理员的所有操作记录
        </Header.Subheader>
      </Header>
      
      <Form>
        <Form.Group>
          <Form.Input
            fluid
            label='管理员用户名'
            size={'small'}
            width={3}
            value={username}
            placeholder='可选，筛选特定管理员'
            name='username'
            onChange={handleInputChange}
          />
          <Form.Field width={3}>
            <label>操作类型</label>
            <Select
              fluid
              placeholder='选择操作类型'
              value={actionType}
              options={ACTION_TYPE_OPTIONS}
              onChange={(e, { value }) => setActionType(value)}
            />
          </Form.Field>
          <Form.Input
            fluid
            label='开始时间'
            size={'small'}
            width={4}
            value={start_timestamp}
            type='datetime-local'
            name='start_timestamp'
            onChange={handleInputChange}
          />
          <Form.Input
            fluid
            label='结束时间'
            size={'small'}
            width={4}
            value={end_timestamp}
            type='datetime-local'
            name='end_timestamp'
            onChange={handleInputChange}
          />
          <Form.Button
            fluid
            label='操作'
            size={'small'}
            width={2}
            color={'green'}
            loading={loading}
            onClick={refresh}
          >
            查询
          </Form.Button>
        </Form.Group>
        
        <Form.Group>
          <Form.Field width={8}>
            <Search
              placeholder='搜索日志内容...'
              value={searchKeyword}
              loading={searching}
              onSearchChange={handleKeywordChange}
              onResultSelect={() => {}}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  searchLogs();
                }
              }}
              showNoResults={false}
            />
          </Form.Field>
          <Form.Button
            width={2}
            loading={searching}
            onClick={searchLogs}
          >
            搜索
          </Form.Button>
        </Form.Group>
      </Form>

      <Table striped>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell style={{ width: '140px' }}>时间</Table.HeaderCell>
            <Table.HeaderCell style={{ width: '120px' }}>管理员</Table.HeaderCell>
            <Table.HeaderCell style={{ width: '120px' }}>操作类型</Table.HeaderCell>
            <Table.HeaderCell>操作详情</Table.HeaderCell>
          </Table.Row>
        </Table.Header>

        <Table.Body>
          {logs
            .slice(
              (activePage - 1) * ITEMS_PER_PAGE,
              activePage * ITEMS_PER_PAGE
            )
            .map((log, idx) => {
              return (
                <Table.Row key={log.id || idx}>
                  <Table.Cell>{renderTimestamp(log.created_at)}</Table.Cell>
                  <Table.Cell>
                    <Label color='blue' size='small'>
                      {log.username}
                    </Label>
                  </Table.Cell>
                  <Table.Cell>
                    <Label color='orange' size='small'>
                      管理操作
                    </Label>
                  </Table.Cell>
                  <Table.Cell>{renderContent(log.content)}</Table.Cell>
                </Table.Row>
              );
            })}
        </Table.Body>

        <Table.Footer>
          <Table.Row>
            <Table.HeaderCell colSpan='4'>
              <Pagination
                floated='right'
                activePage={activePage}
                onPageChange={onPaginationChange}
                size='small'
                siblingRange={1}
                totalPages={
                  Math.ceil(logs.length / ITEMS_PER_PAGE) +
                  (logs.length % ITEMS_PER_PAGE === 0 ? 1 : 0)
                }
                boundaryRange={0}
              />
            </Table.HeaderCell>
          </Table.Row>
        </Table.Footer>
      </Table>
    </>
  );
};

export default AdminLogsTable; 