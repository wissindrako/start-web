import { Container, Heading, Section, Text } from '@react-email/components';

import i18n from '@/lib/i18n';

import { EmailFooter } from '@/emails/components/email-footer';
import { EmailLayout } from '@/emails/components/email-layout';
import { styles } from '@/emails/styles';

export const TemplateLoginCode = (props: {
  language: string;
  code: string;
  expirationInMinutes: number | string;
}) => {
  i18n.changeLanguage(props.language);
  return (
    <EmailLayout
      preview={i18n.t('emails:loginCode.preview')}
      language={props.language}
    >
      <Container style={styles.container}>
        <Heading style={styles.h1}>{i18n.t('emails:loginCode.title')}</Heading>
        <Section style={styles.section}>
          <Text style={styles.text}>{i18n.t('emails:loginCode.intro')}</Text>
          <Text style={styles.code}>{props.code}</Text>
          <Text style={styles.textMuted}>
            {i18n.t('emails:loginCode.validityTime', {
              expiration: props.expirationInMinutes,
            })}
            <br />
            {i18n.t('emails:loginCode.ignoreHelper')}
          </Text>
        </Section>
        <EmailFooter />
      </Container>
    </EmailLayout>
  );
};

export default TemplateLoginCode;
