import PropTypes from "prop-types";
import { useTheme } from "@mui/material/styles";
import {
  IconUser,
  IconShield,
} from "@tabler/icons-react";
import {
  InputAdornment,
  OutlinedInput,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import { LocalizationProvider, DateTimePicker } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
require("dayjs/locale/zh-cn");

const AdminLogType = {
  0: { value: '0', text: '全部', color: '' },
  1: { value: '1', text: '用户管理', color: 'primary' },
  2: { value: '2', text: '渠道管理', color: 'orange' },
  3: { value: '3', text: '系统配置', color: 'secondary' },
  4: { value: '4', text: '兑换码管理', color: 'default' },
  5: { value: '5', text: '日志管理', color: 'info' },
};

export default function AdminLogTableToolBar({
  filterName,
  handleFilterName,
}) {
  const theme = useTheme();
  const grey500 = theme.palette.grey[500];

  return (
    <>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={{ xs: 3, sm: 2, md: 4 }}
        padding={"24px"}
        paddingBottom={"0px"}
      >
        <FormControl>
          <InputLabel htmlFor="admin-username-label">操作员</InputLabel>
          <OutlinedInput
            id="username"
            name="username"
            sx={{
              minWidth: "100%",
            }}
            label="操作员"
            value={filterName.username}
            onChange={handleFilterName}
            placeholder="操作员用户名"
            startAdornment={
              <InputAdornment position="start">
                <IconUser stroke={1.5} size="20px" color={grey500} />
              </InputAdornment>
            }
          />
        </FormControl>

        <FormControl sx={{ minWidth: "22%" }}>
          <InputLabel htmlFor="admin-type-label">操作类型</InputLabel>
          <Select
            id="admin-type-label"
            label="操作类型"
            value={filterName.type}
            name="type"
            onChange={handleFilterName}
            sx={{
              minWidth: "100%",
            }}
            MenuProps={{
              PaperProps: {
                style: {
                  maxHeight: 200,
                },
              },
            }}
          >
            {Object.values(AdminLogType).map((option) => {
              return (
                <MenuItem key={option.value} value={option.value}>
                  {option.text}
                </MenuItem>
              );
            })}
          </Select>
        </FormControl>
      </Stack>

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={{ xs: 3, sm: 2, md: 4 }}
        padding={"24px"}
      >
        <FormControl>
          <LocalizationProvider
            dateAdapter={AdapterDayjs}
            adapterLocale={"zh-cn"}
          >
            <DateTimePicker
              label="起始时间"
              ampm={false}
              name="start_timestamp"
              value={
                filterName.start_timestamp === 0
                  ? null
                  : dayjs.unix(filterName.start_timestamp)
              }
              onChange={(newValue) => {
                handleFilterName({
                  target: {
                    name: "start_timestamp",
                    value: newValue === null ? 0 : newValue.unix(),
                  },
                });
              }}
              slotProps={{
                actionBar: {
                  actions: ["today", "clear", "accept"],
                },
              }}
            />
          </LocalizationProvider>
        </FormControl>

        <FormControl>
          <LocalizationProvider
            dateAdapter={AdapterDayjs}
            adapterLocale={"zh-cn"}
          >
            <DateTimePicker
              label="结束时间"
              ampm={false}
              name="end_timestamp"
              value={
                filterName.end_timestamp === 0
                  ? null
                  : dayjs.unix(filterName.end_timestamp)
              }
              onChange={(newValue) => {
                handleFilterName({
                  target: {
                    name: "end_timestamp",
                    value: newValue === null ? 0 : newValue.unix(),
                  },
                });
              }}
              slotProps={{
                actionBar: {
                  actions: ["today", "clear", "accept"],
                },
              }}
            />
          </LocalizationProvider>
        </FormControl>
      </Stack>
    </>
  );
}

AdminLogTableToolBar.propTypes = {
  filterName: PropTypes.object,
  handleFilterName: PropTypes.func,
}; 