app.initializers.add('<%= params.packageName %>', () => {
  console.log('[<%= params.packageName %>] Hello, admin!');
});
