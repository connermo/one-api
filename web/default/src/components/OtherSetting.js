import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Divider,
  Form,
  Grid,
  Header,
  Message,
  Modal,
} from 'semantic-ui-react';
import { Link } from 'react-router-dom';
import { API, showError, showSuccess, verifyJSON } from '../helpers';
import { marked } from 'marked';

const OtherSetting = () => {
  const { t } = useTranslation();
  let [inputs, setInputs] = useState({
    Footer: '',
    Notice: '',
    About: '',
    SystemName: '',
    Logo: '',
    HomePageContent: '',
    Theme: '',
  });
  let [loading, setLoading] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateData, setUpdateData] = useState({
    tag_name: '',
    content: '',
  });

  const getOptions = async () => {
    const res = await API.get('/api/option/');
    const { success, message, data } = res.data;
    if (success) {
      let newInputs = {};
      data.forEach((item) => {
        if (item.key in inputs) {
          newInputs[item.key] = item.value;
        }
      });
      setInputs(newInputs);
    } else {
      showError(message);
    }
  };

  useEffect(() => {
    getOptions().then();
  }, []);

  const updateOption = async (key, value) => {
    setLoading(true);
    const res = await API.put('/api/option/', {
      key,
      value,
    });
    const { success, message } = res.data;
    if (success) {
      setInputs((inputs) => ({ ...inputs, [key]: value }));
    } else {
      showError(message);
    }
    setLoading(false);
  };

  const handleInputChange = async (e, { name, value }) => {
    setInputs((inputs) => ({ ...inputs, [name]: value }));
  };

  const submitNotice = async () => {
    await updateOption('Notice', inputs.Notice);
  };

  const submitSystemName = async () => {
    await updateOption('SystemName', inputs.SystemName);
  };

  const submitTheme = async () => {
    await updateOption('Theme', inputs.Theme);
  };

  const submitLogo = async () => {
    await updateOption('Logo', inputs.Logo);
  };

  const submitAbout = async () => {
    await updateOption('About', inputs.About);
  };

  const submitOption = async (key) => {
    await updateOption(key, inputs[key]);
  };

  return (
    <Grid columns={1}>
      <Grid.Column>
        <Form loading={loading}>
          <Header as='h3'>{t('setting.other.notice.title')}</Header>
          <Form.Group widths='equal'>
            <Form.TextArea
              label={t('setting.other.notice.content')}
              placeholder={t('setting.other.notice.content_placeholder')}
              value={inputs.Notice}
              name='Notice'
              onChange={handleInputChange}
              style={{ minHeight: 100, fontFamily: 'JetBrains Mono, Consolas' }}
            />
          </Form.Group>
          <Form.Button onClick={submitNotice}>
            {t('setting.other.notice.buttons.save')}
          </Form.Button>

          <Divider />
          <Header as='h3'>{t('setting.other.system.title')}</Header>
          <Form.Group widths='equal'>
            <Form.Input
              label={t('setting.other.system.name')}
              placeholder={t('setting.other.system.name_placeholder')}
              value={inputs.SystemName}
              name='SystemName'
              onChange={handleInputChange}
            />
          </Form.Group>
          <Form.Button onClick={submitSystemName}>
            {t('setting.other.system.buttons.save_name')}
          </Form.Button>
          <Form.Group widths='equal'>
            <Form.Input
              label={t('setting.other.system.theme.title')}
              placeholder={t('setting.other.system.theme.placeholder')}
              value={inputs.Theme}
              name='Theme'
              onChange={handleInputChange}
            />
          </Form.Group>
          <Form.Button onClick={submitTheme}>
            {t('setting.other.system.buttons.save_theme')}
          </Form.Button>
          <Form.Group widths='equal'>
            <Form.Input
              label={t('setting.other.system.logo')}
              placeholder={t('setting.other.system.logo_placeholder')}
              value={inputs.Logo}
              name='Logo'
              type='url'
              onChange={handleInputChange}
            />
          </Form.Group>
          <Form.Button onClick={submitLogo}>
            {t('setting.other.system.buttons.save_logo')}
          </Form.Button>

          <Divider />
          <Header as='h3'>{t('setting.other.content.title')}</Header>
          <Form.Group widths='equal'>
            <Form.TextArea
              label={t('setting.other.content.homepage.title')}
              placeholder={t('setting.other.content.homepage.placeholder')}
              value={inputs.HomePageContent}
              name='HomePageContent'
              onChange={handleInputChange}
              style={{ minHeight: 150, fontFamily: 'JetBrains Mono, Consolas' }}
            />
          </Form.Group>
          <Form.Button onClick={() => submitOption('HomePageContent')}>
            {t('setting.other.content.buttons.save_homepage')}
          </Form.Button>
          <Form.Group widths='equal'>
            <Form.TextArea
              label={t('setting.other.content.about.title')}
              placeholder={t('setting.other.content.about.placeholder')}
              value={inputs.About}
              name='About'
              onChange={handleInputChange}
              style={{ minHeight: 150, fontFamily: 'JetBrains Mono, Consolas' }}
            />
          </Form.Group>
          <Form.Button onClick={submitAbout}>
            {t('setting.other.content.buttons.save_about')}
          </Form.Button>
          <Message>{t('setting.other.copyright.notice')}</Message>
          <Form.Group widths='equal'>
            <Form.Input
              label={t('setting.other.content.footer.title')}
              placeholder={t('setting.other.content.footer.placeholder')}
              value={inputs.Footer}
              name='Footer'
              onChange={handleInputChange}
            />
          </Form.Group>
          <Form.Button onClick={() => submitOption('Footer')}>
            {t('setting.other.content.buttons.save_footer')}
          </Form.Button>
        </Form>
      </Grid.Column>
    </Grid>
  );
};

export default OtherSetting;
