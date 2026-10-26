import {
  Button,
  Container,
  Heading,
  Section,
  Text,
} from '@react-email/components';
import dayjs from 'dayjs';

import i18n from '@/lib/i18n';

import { EmailFooter } from '@/emails/components/email-footer';
import { EmailLayout } from '@/emails/components/email-layout';
import { styles } from '@/emails/styles';

export const TemplateInvitation = (props: {
  language: string;
  url: string;
  // Empty when the invitation is to this center
  systemName?: string;
  invitedByName: string;
  expiresAt: string;
}) => {
  i18n.changeLanguage(props.language);
  const system = props.systemName ? { system: props.systemName } : null;
  const introKey = system ? 'introSystem' : 'intro';
  const intro = props.invitedByName
    ? i18n.t(`emails:invitation.${introKey}By`, {
        name: props.invitedByName,
        ...system,
      })
    : i18n.t(`emails:invitation.${introKey}`, { ...system });
  return (
    <EmailLayout
      preview={i18n.t('emails:invitation.preview')}
      language={props.language}
    >
      <Container style={styles.container}>
        <Heading style={styles.h1}>
          {system
            ? i18n.t('emails:invitation.titleSystem', system)
            : i18n.t('emails:invitation.title')}
        </Heading>
        <Section style={styles.section}>
          <Text style={styles.text}>{intro}</Text>
          <Button style={styles.button} href={props.url}>
            {i18n.t('emails:invitation.action')}
          </Button>
          <Text style={styles.textMuted}>
            {i18n.t('emails:invitation.validity', {
              date: dayjs(props.expiresAt).format('DD/MM/YYYY HH:mm'),
            })}
            <br />
            {i18n.t('emails:invitation.ignoreHelper')}
          </Text>
        </Section>
        <EmailFooter />
      </Container>
    </EmailLayout>
  );
};

export default TemplateInvitation;
