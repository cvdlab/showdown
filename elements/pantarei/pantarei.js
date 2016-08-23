var Pantarei

(function () {

  function setup_node (node) {
    setup_node_event(node)
    parse_node(node, node)
  }

  function parse_node (node, root) {
    if (node.nodeType === node.TEXT_NODE) {
      parse_node_text(node, root)
      return
    }
    if (node.nodeType !== node.ELEMENT_NODE) {
      return
    }
    if (node.nodeName.toUpperCase() === TAG_TEMPLATE) {
      parse_node_template(node, root)
      return
    }
    parse_node_element(node, root)
  }

  function parse_node_element (node, root) {
    node.p = {}
    node.p.root = root
    node.p.directives = []

    parse_attributes(node, node.attributes)

    let child = node.firstChild;
    while (child) {
      parse_node(child, root);
      child = child.nextSibling;
    }
  }

  function parse_attributes (node, attributes) {
    for (let i = 0, n = attributes.length; i < n; i++) {
      let attribute = attributes[i]
      parse_attribute(node, attribute)
    }
  }

  function parse_attribute (node, attribute) {
    let name = attribute.name
    let value = attribute.value

    if (is_expression(value)) {
      let getter = parse_expression(value)
      let handler = function (data) {
        this[name] = getter(data)
      }
      let directive = {
        type: 'attribute',
        name: attribute.name,
        value: attribute.value,
        handler: handler
      }
      node.p.directives.push(directive)
      return
    }

    if (is_event(name)) {
      let root = node.p.root
      let event_name = parse_event(name)
      if (!root.listeners.hasOwnProperty(event_name)) {
        root.listeners[event_name] = true
        root.addEventListener(event_name, root.listener, false)
      }
    }

    return null
  }

  var OPEN_EXPRESSION = '{{'
  var CLOSE_EXPRESSION = '}}'

  function is_expression (string) {
    return string.startsWith(OPEN_EXPRESSION) && string.endsWith(CLOSE_EXPRESSION)
  }

  function parse_expression (string) {
    var length = string.length
    var first_char = OPEN_EXPRESSION.length
    var last_char = length - CLOSE_EXPRESSION.length
    var path = string.substring(first_char, last_char)

    var parts = path.split('.')
    var n = parts.length

    if (n == 1) {
      return function (value) {
        return value[path]
      }
    }

    return function (value) {
      for (let i = 0; i < n && value; i++) {
        let part = parts[i]
        value = value[part]
      }
      return value
    }
  }

  var PREFIX_EVENT = 'on-'

  function is_event (string) {
    return string.startsWith(PREFIX_EVENT)
  }

  function parse_event (string) {
    return string.slice(PREFIX_EVENT.length)
  }

  function parse_node_text (node, root) {
    let content = node.textContent.trim()
    if (content === '') {
      return
    }
    if (is_expression(content)) {
      let getter = parse_expression(content)
      let template = document.createElement('template')
      node.parentNode.insertBefore(template, node)
      template.setAttribute('is', 'text')
      template.setAttribute('content', content)
      template.p = {}
      let handler = function (data) {
        node.textContent = getter(data)
      }
      template.p.directive = {
        type: 'text',
        content: content,
        handler: handler
      }
    }
  }

  function parse_node_template (template, root) {
    let is = template.getAttribute('is')

    if (is === 'text') {
      parse_node_template_text(template, root)
      return
    }
    if (is === 'if') {
      parse_node_template_if(template, root)
      return
    }
    if (is === 'repeat') {
      parse_node_template_repeat(template, root)
      return
    }
  }

  var stage = document.createDocumentFragment()

  function parse_node_template_if (template, root) {
    template.p = {}
    template.p.root = root

    let content = template.content
    let node = content.children[0]
    stage.appendChild(node);
    template.p.node = node.cloneNode(true);
    content.appendChild(node);

    template.p.test_path = template.getAttribute('if')
    template.p.test_func = parse_expression(template.p.test_path)
    template.p.clone = null;
  }

  function parse_node_template_repeat (template, root) {
    template.p = {}
    template.p.root = root

    let content = template.content
    let node = content.children[0]
    stage.appendChild(node);
    template.p.node = node.cloneNode(true);
    content.appendChild(node);

    template.p.item_name = template.getAttribute('item') || 'item'
    template.p.index_name = template.getAttribute('index') || 'index'
    template.p.items_path = template.getAttribute('items')
    template.p.items_func = parse_expression(template.p.items_path)
    template.p.items = []
    template.p.clones = []
  }

  function setup_node_event (root) {

    function listener (event) {
      var handlers = root.handlers || root
      var event_type = event.type
      var event_name = PREFIX_EVENT + event_type
      var target = event.target

      var bubble = true
      var stopPropagation = event.stopPropagation
      event.stopPropagation = function () {
        stopPropagation.call(event)
        bubble = false
      }

      while (bubble) {
        if (target === root) {
          bubble = false
        }
        let handler_name = target.getAttribute(event_name)
        if (handler_name) {
          let handler = handlers[handler_name]
          handler.call(handlers, event, event.detail)
        }
        target = target.parentNode
      }
    }

    root.listener = listener
    root.listeners = {}
  }

  var TAG_TEMPLATE = 'TEMPLATE'

  function render_node (node, data) {
    if (node.nodeType !== node.ELEMENT_NODE) {
      return
    }
    if (node.nodeName.toUpperCase() === TAG_TEMPLATE) {
      render_node_template(node, data)
      return
    }
    render_node_element(node, data)
  }

  function render_node_element (node, data) {
    let p = node.p
    if (!p) {
      return
    }

    let directives = p.directives
    if (!directives) {
      return
    }

    for (let i = 0, n = directives.length; i < n; i++) {
      let directive = directives[i]
      directive.handler.call(node, data)
    }

    let child = node.firstElementChild;
    while (child) {
      render_node(child, data);
      child = child.nextElementSibling;
    }

    if (node.update) {
      node.update()
    }
  }

  function render_node_template (template, data) {
    let is = template.getAttribute('is')

    if (is === 'text') {
      render_node_template_text(template, data)
      return
    }
    if (is === 'if') {
      render_node_template_if(template, data)
      return
    }
    if (is === 'repeat') {
      render_node_template_repeat(template, data)
      return
    }
  }

  function render_node_template_text (node, data) {
    let p = node.p
    let directive = p.directive
    let handler = directive.handler
    handler(data)
  }

  function render_node_template_if (template, data) {

    function create_clone () {
      let root = template.p.root
      let node = template.p.node
      let clone = node.cloneNode(true)
      parse_node(clone, root)
      console.log(clone)
      template.parentNode.insertBefore(clone, template);
      template.p.clone = clone
    }

    function render_clone () {
      render_node(template.p.clone, data)
    }

    function remove_clone () {
      template.p.clone.remove();
      template.p.clone = null
    }

    let old_test = template.p.test
    let new_test = template.p.test_func(data);
    template.p.test = new_test

    if (new_test) {
      if (old_test) {
        render_clone()
      } else {
        create_clone()
        render_clone()
      }
    } else {
      if (old_test) {
        remove_clone()
      }
    }

  }

  function render_node_template_repeat (template, data) {

    function create_clone (index) {
      let root = template.p.root
      let node = template.p.node
      let clone = node.cloneNode(true)
      parse_node(clone, root)
      template.parentNode.insertBefore(clone, template)
      template.p.clones[index] = clone
    }

    function render_clone (index) {
      let clone = template.p.clones[index]
      let clone_data = Object.assign({}, data)
      let item = template.p.items[index]
      clone_data[template.p.item_name] = item
      clone_data[template.p.index_name] = index
      render_node(clone, clone_data)
    }

    function remove_clone (index) {
      let clone = template.p.clones[index]
      clone.remove()
      template.p.clones[index] = null
    }

    let old_items = template.p.items
    let new_items = template.p.items_func(data)

    if (!Array.isArray(new_items)) {
      new_items = []
    }

    template.p.items = new_items.slice()

    let old_items_count = old_items.length
    let new_items_count = new_items.length

    if (new_items_count < old_items_count) {
      for (let index = 0; index < new_items_count; index++) {
        render_clone(index)
      }
      for (let index = new_items_count; index < old_items_count; index++) {
        remove_clone(index)
      }
    }
    else {
      for (let index = 0; index < old_items_count; index++) {
        render_clone(index)
      }
      for (let index = old_items_count; index < new_items_count; index++) {
        create_clone(index)
        render_clone(index)
      }
    }
  }

  function create_node (config) {
    var doc = document._currentScript.ownerDocument
    var template = doc.querySelector('template')
    var name = template.getAttribute('is')
    var content = template.content

    var prototype = Object.create(HTMLElement.prototype)

    prototype.before_create = function () {}
    prototype.after_create = function () {}

    prototype.before_attach = function () {}
    prototype.after_attach = function () {}

    prototype.before_detach = function () {}
    prototype.after_detach = function () {}

    prototype.should_update = function () { return true }

    prototype.before_update = function () {}
    prototype.after_update = function () {}

    // prototype.properties = {}

    // Object.assign(prototype, config)
    for (let p in config) {
      prototype[p] = config[p]
    }


    prototype.createdCallback = function () {
      this.before_create()
      var root = this.createShadowRoot()
      var imported = document.importNode(content, true)
      root.appendChild(imported)
      var node = root.children[root.children.length === 1 ? 0 : 1]
      this.node = node
      this.node.handlers = this
      this._init_props()
      Pantarei.setup(node)
      this._init_refs()
      this.after_create()
    }

    prototype._init_props = function () {
      let properties = this.properties || {}
      for (let name in properties) {
        let property = properties[name]
        let value = property.value
        if (this.hasAttribute(name)) {
          value = this.getAttribute(name)
        }
        if (value !== undefined) {
          this[name] = value
        }
      }
    }

    prototype._init_refs = function () {
      let refs = {}
      let nodes = this.shadowRoot.querySelectorAll('[ref]')
      for (let i = 0, n = nodes.length; i < n; i++) {
        let node = nodes[i]
        let ref = node.getAttribute('ref')
        node.ref = ref
        refs[ref] = node
      }
      this.refs = refs
    }

    prototype.attachedCallback = function () {
      this.before_attach()
      Pantarei.update(this.node, this)
      this._attached = true
      this.after_attach()
    }

    prototype.detachedCallback = function () {
      this.before_detach()
      this._attached = false
      this.after_detach()
    }

    prototype.update = function () {
      var pass = this.should_update()
      if (!pass) {
        return
      }
      this.before_update()
      Pantarei.update(this.node, this)
      this.after_update()
    };

    prototype.fire = function (type, detail) {
      let self = this
      let event = new CustomEvent(type, { bubbles: true, cancelable: true, detail: detail })
      requestAnimationFrame(function () {
        self.dispatchEvent(event)
      })
      return event
    }

    prototype.action = function (name, data) {
      this.fire('action', { name: name, data: data })
      return this
    }

    prototype.async = function (f) {
      requestAnimationFrame(f.bind(this))
    }

    let Element = document.registerElement(name, { prototype: prototype })

    return Element;
  }

  Pantarei = create_node

  Pantarei.setup = setup_node

  Pantarei.update = render_node

}())