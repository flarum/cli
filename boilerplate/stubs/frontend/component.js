import Component from 'flarum/common/Component';

export default class <%= className %> extends Component {
  oninit(vnode) {
    super.oninit(vnode);
  }

  oncreate(vnode) {
    super.oncreate(vnode);
  }

  onupdate(vnode) {
    super.onupdate(vnode);
  }

  view() {
    return (
      <div className="<%= className %>">
        // See https://docs.flarum.org/extend/frontend.html#components for more information.
      </div>
    );
  }
}
