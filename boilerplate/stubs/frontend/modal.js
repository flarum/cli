import Modal from 'flarum/common/components/Modal';

export default class <%= className %> extends Modal {
  className() {
    return 'Modal--small <%= className %>';
  }

  title() {
    return app.translator.trans('<%= extensionId %>._');
  }

  content() {
    return (
      <div className="Modal-body">
        // See https://docs.flarum.org/extend/interactive-components.html#modals for more information.
      </div>
    );
  }
}
