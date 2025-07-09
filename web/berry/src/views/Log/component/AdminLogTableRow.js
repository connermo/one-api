import PropTypes from 'prop-types';

import { TableRow, TableCell } from '@mui/material';

import { timestamp2string } from 'utils/common';
import Label from 'ui-component/Label';

function renderType(type) {
  const typeMap = {
    1: { text: '用户管理', color: 'primary' },
    2: { text: '渠道管理', color: 'orange' },
    3: { text: '系统配置', color: 'secondary' },
    4: { text: '兑换码管理', color: 'default' },
    5: { text: '日志管理', color: 'info' }
  };
  
  const typeOption = typeMap[type];
  if (typeOption) {
    return (
      <Label variant="filled" color={typeOption.color}>
        {typeOption.text}
      </Label>
    );
  } else {
    return (
      <Label variant="filled" color="error">
        未知类型
      </Label>
    );
  }
}

export default function AdminLogTableRow({ item }) {
  return (
    <>
      <TableRow tabIndex={item.id}>
        <TableCell>{timestamp2string(item.created_at)}</TableCell>
        <TableCell>
          <Label color="default" variant="outlined">
            {item.username}
          </Label>
        </TableCell>
        <TableCell>{renderType(item.type)}</TableCell>
        <TableCell>
          {item.target_user ? (
            <Label color="primary" variant="soft">
              {item.target_user}
            </Label>
          ) : (
            '-'
          )}
        </TableCell>
        <TableCell>{item.content}</TableCell>
      </TableRow>
    </>
  );
}

AdminLogTableRow.propTypes = {
  item: PropTypes.object
}; 