// The "Who's playing?" screen shown before the game starts: Admin, each saved user, Add new user, or Guest.
import { Profile } from './profile.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function runLogin() {
  const el = document.getElementById('login');
  const $ = (s) => el.querySelector(s);
  return new Promise((done) => {
    let mode = null, target = null;
    const home = () => {
      mode = null; target = null;
      $('#lg-home').style.display = ''; $('#lg-form').style.display = 'none';
      const users = Profile.users();
      $('#lg-users').innerHTML = users.map((u) => `<button class="lg-user" data-id="${esc(u.id)}"><i>${esc(u.name[0].toUpperCase())}</i><b>${esc(u.name)}</b></button>`).join('')
        + `<button class="lg-user admin" data-admin="1"><i>★</i><b>Admin</b><small>everything unlocked</small></button>`;
      el.querySelectorAll('.lg-user').forEach((b) => (b.onclick = () => (b.dataset.admin ? (Profile.enterAdmin(), finish()) : form('user', users.find((u) => u.id === b.dataset.id)))));
    };
    const form = (m, u) => {
      mode = m; target = u || null;
      $('#lg-home').style.display = 'none'; $('#lg-form').style.display = '';
      $('#lg-err').textContent = '';
      const T = {
        user: ['Welcome back, ' + (u ? u.name : ''), 'Enter your password.', 'Sign in'],
        login: ['Sign in', 'Your name and password. Your account and progress follow you to any device.', 'Sign in'],
        admin: ['Admin', 'Enter the admin password.', 'Sign in'],
        adminSetup: ['Set up Admin', 'Create the admin password for this device. Only you should know it. Admin has everything unlocked and can delete accounts.', 'Create admin'],
        create: ['Add new user', Profile.cloud ? 'Just a name and a password. Your account is saved online for good: sign in on any device and pick up where you left off.' : 'Just a name and a password. Your progress saves to this profile on this device.', 'Create profile'],
      }[m];
      $('#lg-title').textContent = T[0]; $('#lg-sub').textContent = T[1]; $('#lg-go').textContent = T[2];
      $('#lg-name-f').style.display = m === 'create' || m === 'login' ? '' : 'none';
      $('#lg-pw2-f').style.display = m === 'create' || m === 'adminSetup' ? '' : 'none';
      $('#lg-name').value = ''; $('#lg-pw').value = ''; $('#lg-pw2').value = '';
      setTimeout(() => (m === 'create' || m === 'login' ? $('#lg-name') : $('#lg-pw')).focus(), 30);
    };
    const finish = () => { el.classList.remove('on'); done(Profile.cur); };
    $('#lg-new').onclick = () => form('create');
    const si = $('#lg-signin');
    if (si) { si.style.display = Profile.cloud ? '' : 'none'; si.onclick = () => form('login'); }
    $('#lg-guest').onclick = () => { Profile.guest(); finish(); };
    $('#lg-back').onclick = home;
    const go = $('#lg-go');
    $('#lg-form').onsubmit = async (e) => {
      e.preventDefault();
      if (go.disabled) return;
      const pw = $('#lg-pw').value, pw2 = $('#lg-pw2').value;
      $('#lg-err').textContent = '';
      if ((mode === 'create' || mode === 'adminSetup') && pw !== pw2) { $('#lg-err').textContent = 'The two passwords do not match.'; return; }
      go.disabled = true;
      try {
        if (mode === 'create') await Profile.createUser($('#lg-name').value, pw);
        else if (mode === 'user') await Profile.signIn(target.id, pw);
        else if (mode === 'login') await Profile.signIn('n:' + $('#lg-name').value, pw);
        else if (mode === 'admin') await Profile.signInAdmin(pw);
        else if (mode === 'adminSetup') await Profile.setupAdmin(pw);
        finish();
      } catch (err) { $('#lg-err').textContent = err.message || String(err); }
      go.disabled = false;
    };
    home();
    el.classList.add('on');
  });
}
