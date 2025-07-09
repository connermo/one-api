import React, { useContext, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { UserContext } from '../context/User';
import { API, getLogo, showError, showSuccess } from '../helpers';
import { Spin, Card, Result, Button } from '@douyinfe/semi-ui';

const CustomOAuth = () => {
  const [searchParams] = useSearchParams();
  const [userState, userDispatch] = useContext(UserContext);
  const [prompt, setPrompt] = useState('处理中...');
  const [processing, setProcessing] = useState(true);
  let navigate = useNavigate();

  const sendCode = async (code, state, count) => {
    const res = await API.get(`/api/oauth/custom?code=${code}&state=${state}`);
    const { success, message, data } = res.data;
    if (success) {
      if (message === 'bind') {
        showSuccess('绑定成功！');
        navigate('/setting');
      } else {
        userDispatch({ type: 'login', payload: data });
        localStorage.setItem('user', JSON.stringify(data));
        showSuccess('登录成功！');
        navigate('/');
      }
      return;
    } else {
      showError(message);
      if (count === 0) {
        setPrompt(`操作失败，重定向至登录界面中...`);
        setTimeout(() => {
          navigate('/login');
        }, 3000);
        return;
      }
      count++;
      setPrompt(`出现错误，第 ${count} 次重试中...`);
      setTimeout(() => {
        sendCode(code, state, count).then();
      }, 2000);
    }
  };

  useEffect(() => {
    let code = searchParams.get('code');
    let state = searchParams.get('state');
    sendCode(code, state, 0).then(() => {
      setProcessing(false);
    });
  }, []);

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f5f5f5'
      }}
    >
      <Card
        style={{
          width: 450,
          padding: '40px',
          textAlign: 'center'
        }}
      >
        <div style={{ marginBottom: '20px' }}>
          <img
            src={getLogo()}
            alt="logo"
            style={{ height: '50px', marginBottom: '20px' }}
          />
          <h2>自定义OAuth登录</h2>
        </div>
        
        {processing ? (
          <div style={{ padding: '40px 0' }}>
            <Spin size="large" spinning={true}>
              <div style={{ minHeight: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <h4>{prompt}</h4>
              </div>
            </Spin>
          </div>
        ) : (
          <Result
            status="info"
            title={prompt}
            extra={
              <Button theme="solid" type="primary" onClick={() => navigate('/login')}>
                返回登录
              </Button>
            }
          />
        )}
      </Card>
    </div>
  );
};

export default CustomOAuth; 