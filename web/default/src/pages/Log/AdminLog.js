import React from 'react';
import { Card } from 'semantic-ui-react';
import AdminLogsTable from '../../components/AdminLogsTable';

const AdminLog = () => {
  return (
    <div className='dashboard-container'>
      <Card fluid className='chart-card'>
        <Card.Content>
          <Card.Header className='header'>管理员操作日志</Card.Header>
          <AdminLogsTable />
        </Card.Content>
      </Card>
    </div>
  );
};

export default AdminLog; 