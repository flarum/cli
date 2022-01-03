import app from 'flarum/forum/app';

app.initializers.add('<%= params.packageName %>', () => {
  console.log('[<%= params.packageName %>] Hello, forum!');
});
