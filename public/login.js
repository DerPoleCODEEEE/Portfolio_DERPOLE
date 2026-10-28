'use strict';

const i18n = makeI18n({
  en: {
    title: 'Client login', lead: 'You get your login from me after we\'ve talked.', user: 'Username', pass: 'Password',
    submit: 'Log in', noacc: 'No account yet?', contact: 'Get in touch',
    invalid: 'Username or password is wrong.', too_many: 'Too many attempts. Please wait a few minutes.', error: 'Something went wrong. Please try again.',
  },
  de: {
    title: 'Kunden-Login', lead: 'Deine Zugangsdaten bekommst du von mir, nachdem wir gesprochen haben.', user: 'Benutzername', pass: 'Passwort',
    submit: 'Einloggen', noacc: 'Noch kein Konto?', contact: 'Schreib mir',
    invalid: 'Benutzername oder Passwort stimmt nicht.', too_many: 'Zu viele Versuche. Bitte warte ein paar Minuten.', error: 'Da ist was schiefgelaufen. Probier es nochmal.',
  },
});
i18n.apply();

const form = $('[data-login]');
const status = $('[data-status]');
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('button[type="submit"]', form);
  btn.disabled = true;
  status.className = 'form__status';
  status.textContent = '';
  try {
    const { role } = await api('/api/auth/login', {
      method: 'POST',
      body: { username: form.username.value.trim(), password: form.password.value },
    });
    location.href = role === 'admin' ? '/admin' : '/portal';
  } catch (err) {
    status.className = 'form__status is-error';
    status.textContent = i18n.t(['invalid', 'too_many'].includes(err.code) ? err.code : 'error');
    form.password.value = '';
    form.password.focus();
  } finally {
    btn.disabled = false;
  }
});
