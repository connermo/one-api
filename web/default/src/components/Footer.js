import React, { useEffect, useState } from 'react';

import { Container, Segment } from 'semantic-ui-react';
import { getFooterHTML, getSystemName } from '../helpers';

const Footer = () => {
  return (
    <footer style={{ textAlign: 'center', padding: 16, color: '#888' }}>
      Powered by One API
    </footer>
  );
};

export default Footer;
