import { TableCell, TableHead, TableRow } from '@mui/material';

const AdminLogTableHead = () => {
  return (
    <TableHead>
      <TableRow>
        <TableCell>时间</TableCell>
        <TableCell>操作员</TableCell>
        <TableCell>操作类型</TableCell>
        <TableCell>目标用户</TableCell>
        <TableCell>操作内容</TableCell>
      </TableRow>
    </TableHead>
  );
};

export default AdminLogTableHead; 