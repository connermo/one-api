import React, { useContext, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { UserContext } from '../context/User';
import { API, getLogo, showError, showInfo, showSuccess } from '../helpers';
import { Dimmer, Loader, Segment } from 'semantic-ui-react';

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
    <>
      <div
        className="ui middle aligned center aligned grid"
        style={{ height: '100vh' }}
      >
        <div className="column" style={{ maxWidth: 450 }}>
          <h2 className="ui teal image header">
            <img
              src={getLogo()}
              className="image"
              alt="logo"
            />
            <div className="content">
              自定义OAuth登录
            </div>
          </h2>
          <Segment>
            <Dimmer active={processing}>
              <Loader size='large'>{prompt}</Loader>
            </Dimmer>
            <div className="ui form">
              <div className="ui centered grid">
                <div className="row">
                  <div className="column">
                    <h4>{prompt}</h4>
                  </div>
                </div>
              </div>
            </div>
          </Segment>
          <div className="ui message">
            <Link to="/login">返回登录</Link>
          </div>
        </div>
      </div>
    </>
  );
};

export default CustomOAuth; 