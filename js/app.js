var React = require('react/addons');
var Morearty = require('morearty');
var Reflux = require('reflux');
var Router = require('director').Router;
var Immutable = require('immutable');

var NOW_SHOWING = Object.freeze({ALL: 'all', ACTIVE: 'active', COMPLETED: 'completed'});
var currentId = 2;
var state = {
    nowShowing: 'all',
    items: [{
        id: 1,
        title: 'My first task',
        completed: false,
        editing: false
    }]
};

var Ctx = Morearty.createContext(state, {}, {});

/*
 NOTE:
 Here we telling Reflux to extend Reflux.Store.prototype with getMoreartyContext method.
 Read Reflux documentation about Reflux.StoreMethods.
 */
Reflux.StoreMethods.getMoreartyContext = function() {
    return Ctx;
};

var TodoActions = Reflux.createActions([
    'add',
    'edit',
    'remove',
    'toggle',
    'toggleAll',
    'clearCompleted'
]);

var TodoStore = Reflux.createStore({
    listenables: TodoActions, //NOTE: read Reflux documentation.

    //NOTE: Here we can set our binding\sub-binding variables. Again, :D read Reflux documentation.
    init: function() {
        this.rootBinding = this.getMoreartyContext().getBinding();
        this.itemsBinding = this.rootBinding.sub('items');
    },

    onAdd: function (title) {
        //NOTE: binding-change logic from todomvc-moreartyjs components.
        this.itemsBinding.update(function (todos) { // add new item
            return todos.push(Immutable.Map({
                id: currentId++,
                title: title,
                completed: false,
                editing: false
            }));
        });
    },

    onEdit: function (id, title) {
        /*
         NOTE:
         Here we have pure value (item.id). But we want to change binding.
         */
        var itemIndex = this.itemsBinding.get().findIndex(function(item) {
            return item.get('id') === id
        });
        var itemBinding = this.itemsBinding.sub(itemIndex);
        itemBinding
            .atomically()
            .set('title', title)
            .set('editing', false)
            .commit();
    },

    onRemove: function (id) {
        var itemIndex = this.itemsBinding.get().findIndex(function(item) {
            return item.get('id') === id
        });
        this.itemsBinding.delete(itemIndex);
    },

    onToggle: function (id, checked) {
        var itemIndex = this.itemsBinding.get().findIndex(function(item) {
            return item.get('id') === id
        });
        var itemBinding = this.itemsBinding.sub(itemIndex);
        itemBinding.atomically().set('completed', checked).commit();
    },

    onToggleAll: function (checked) {
        this.itemsBinding.update(function (items) {
            return items.map(function (item) {
                return item.set('completed', checked);
            });
        });
    },

    onClearCompleted: function () {
        this.itemsBinding.update(function (items) {
            return items.filter(function (item) {
                return !item.get('completed');
            });
        });
    }
});

var App = React.createClass({
    displayName: 'App',

    mixins: [Morearty.Mixin],

    componentDidMount: function () {
        var binding = this.getDefaultBinding();
        Router({
            '/': binding.set.bind(binding, 'nowShowing', NOW_SHOWING.ALL),
            '/active': binding.set.bind(binding, 'nowShowing', NOW_SHOWING.ACTIVE),
            '/completed': binding.set.bind(binding, 'nowShowing', NOW_SHOWING.COMPLETED)
        }).init();
    },

    render: function () {
        var binding = this.getDefaultBinding();
        return (
            <section id='todoapp'>
                <Header binding={ binding } />
                <TodoList binding={ binding } />
                <Footer binding={ binding } />
            </section>
        );
    }
});

var Header = React.createClass({
    displayName: 'Header',
    mixins: [Morearty.Mixin],

    componentDidMount: function () {
        this.refs.newTodo.getDOMNode().focus(); // focus on show
    },

    handleAdd: function (event) {
        var title = event.target.value;
        if (title) {
            TodoActions.add(title);
            event.target.value = '';
        }
    },

    render: function () {
        return (
            <header id='header'>
                <h1>todos</h1>
                <Morearty.DOM.input id='new-todo' // requestAnimationFrame-friendly wrapper around input
                    ref='newTodo'
                    placeholder='What needs to be done?'
                    onKeyDown={ Morearty.Callback.onEnter(this.handleAdd) } />
            </header>
        );
    }
});

var TodoList = React.createClass({
    displayName: 'TodoList',

    mixins: [Morearty.Mixin],

    handleToggleAll: function (event) {
        TodoActions.toggleAll(event.target.checked);
    },

    render: function () {
        var binding = this.getDefaultBinding();
        var nowShowing = binding.get('nowShowing');
        var itemsBinding = binding.sub('items');
        var items = itemsBinding.get();

        var isShown = function (item) {
            switch (nowShowing) {
                case NOW_SHOWING.ALL:
                    return true;
                case NOW_SHOWING.ACTIVE:
                    return !item.get('completed');
                case NOW_SHOWING.COMPLETED:
                    return item.get('completed');
            }
        };

        var renderTodo = function (item, index) {
            var itemBinding = itemsBinding.sub(index);
            return isShown(item) ? <TodoItem binding={itemBinding} key={itemBinding.toJS('id') } /> : null;
        };

        var allCompleted = !items.find(function (item) {
            return !item.get('completed');
        });

        return (
            <section id='main'>
      {
          items.count() ?
              <Morearty.DOM.input id='toggle-all'
                  type='checkbox'
                  checked={ allCompleted }
                  onChange={ this.handleToggleAll } /> :
              null
          }
                <ul id='todo-list'>{ items.map(renderTodo).toArray() }</ul>
            </section>
        );
    }
});

var TodoItem = React.createClass({
    displayName: 'TodoItem',

    mixins: [Morearty.Mixin],


    componentDidUpdate: function () {
        var ctx = this.getMoreartyContext();
        if (ctx.isChanged(this.getDefaultBinding().sub('editing'))) {
            var node = this.refs.editField.getDOMNode();
            node.focus();
            node.setSelectionRange(0, node.value.length);
        }
    },

    /*
     NOTE: Stating the obvious:
     Here we need to get real value (item.id) from binding.
     Actions must be sent with pure values, not bindings\sub-bindings.
     This is because one action could be listened by multiple stores.
     */
    handleDestroy: function() {
        var id = this.getDefaultBinding().get('id');
        TodoActions.remove(id);
    },

    handleToggleCompleted: function (event) {
        var id = this.getDefaultBinding().get('id');
        TodoActions.toggle(id, event.target.checked);
    },

    /*
     NOTE:
     Component can work with bindings without firing an action.
     This is the same when you using Morearty without Reflux.
     */
    handleToggleEditing: function (editing) {
        this.getDefaultBinding().set('editing', editing);
    },

    handleEditComplete: function (event) {
        var id = this.getDefaultBinding().get('id');
        TodoActions.edit(id, event.target.value);
    },

    render: function () {
        var binding = this.getDefaultBinding();
        var item = binding.get();

        var liClass = React.addons.classSet({
            completed: item.get('completed'),
            editing: item.get('editing')
        });
        var title = item.get('title');

        return (
            <li className={ liClass }>
                <div className='view'>
                    <Morearty.DOM.input className='toggle'
                        type='checkbox'
                        checked={ item.get('completed') }
                        onChange={ this.handleToggleCompleted } />
                    <label onClick={ this.handleToggleEditing.bind(null, true) }>{ title }</label>
                    <button className='destroy' onClick={ this.handleDestroy }></button>
                </div>
                <Morearty.DOM.input className='edit'
                    ref='editField'
                    value={ title }
                    onChange={ Morearty.Callback.set(binding, 'title') }
                    onKeyDown={ Morearty.Callback.onEnter(this.handleEditComplete) }
                    onBlur={ this.handleToggleEditing.bind(null, false) } />
            </li>
        );
    }
});

var Footer = React.createClass({
    displayName: 'Footer',

    mixins: [Morearty.Mixin],

    handleClearCompleted: function () {
        TodoActions.clearCompleted();
    },

    render: function () {
        var binding = this.getDefaultBinding();
        var nowShowing = binding.get('nowShowing');

        var items = binding.get('items');
        var completedItemsCount = items.reduce(function (acc, item) {
            return item.get('completed') ? acc + 1 : acc;
        }, 0);

        return (
            <footer id='footer'>
                <span id='todo-count'>{ items.count() - completedItemsCount + ' items left' }</span>
                <ul id='filters'>
                    <li>
                        <a className={ nowShowing === NOW_SHOWING.ALL ? 'selected' : '' } href='#/'>All</a>
                    </li>
                    <li>
                        <a className={ nowShowing === NOW_SHOWING.ACTIVE ? 'selected' : '' } href='#/active'>Active</a>
                    </li>
                    <li>
                        <a className={ nowShowing === NOW_SHOWING.COMPLETED ? 'selected' : '' } href='#/completed'>Completed</a>
                    </li>
                </ul>
      {
          completedItemsCount ?
              <button id='clear-completed' onClick={ this.handleClearCompleted }>
            { 'Clear completed (' + completedItemsCount + ')' }
              </button> :
              null
          }
            </footer>
        );
    }
});

var Bootstrap = Ctx.bootstrap(App);

React.render(
    <Bootstrap />,
    document.getElementById('root')
);
