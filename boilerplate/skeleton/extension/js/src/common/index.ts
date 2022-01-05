import app from 'flarum/common/app';

app.initializers.add('<%= params.packageName %>', () => {
  console.log('[<%= params.packageName %>] Hello, forum and admin!');
});
