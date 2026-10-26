import { Container, Heading, Section, Text } from '@react-email/components';

import i18n from '@/lib/i18n';

import { EmailFooter } from '@/emails/components/email-footer';
import { EmailLayout } from '@/emails/components/email-layout';
import { styles } from '@/emails/styles';

export const TemplateMailTest = (props: { language: string }) => {
  i18n.changeLanguage(props.language);
  return (
    <EmailLayout
      preview={i18n.t('emails:mailTest.preview')}
      language={props.language}
    >
      <Container style={styles.container}>
        <Heading style={styles.h1}>{i18n.t('emails:mailTest.title')}</Heading>
        <Section style={styles.section}>
          <Text style={styles.text}>{i18n.t('emails:mailTest.intro')}</Text>
        </Section>
        <EmailFooter />
      </Container>
    </EmailLayout>
  );
};

export default TemplateMailTest;
