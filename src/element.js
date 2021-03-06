
// ### Used by nearly every other module

//
SVG.Element = function(node) {
  /* keep reference to the element node */
  if (this.node = node)
    this.type = node.nodeName
  
  /* initialize attribute store with defaults */
  this.attrs = {
    'fill-opacity':   1
  , 'stroke-opacity': 1
  , 'stroke-width':   0
  , 'id':     (node ? node.getAttribute('id') : null)
  , fill:     '#000'
  , stroke:   '#000'
  , opacity:  1
  , x:        0
  , y:        0
  , cx:       0
  , cy:       0
  , width:    0
  , height:   0
  , r:        0
  , rx:       0
  , ry:       0
  }
  
  /* initialize transformation store with defaults */
  this.trans = {
    x:        0
  , y:        0
  , scaleX:   1
  , scaleY:   1
  , rotation: 0
  , skewX:    0
  , skewY:    0
  }
}

//
SVG.extend(SVG.Element, {
  // Move element to given x and y values
  move: function(x, y) {
    return this.attr({
      x: x,
      y: y
    })
  },
  // Move element by its center
  center: function(x, y) {
    var box = this.bbox()
    
    return this.move(x - box.width / 2, y - box.height / 2)
  },
  // Set element size to given width and height
  size: function(width, height) { 
    return this.attr({
      width:  width,
      height: height
    })
  },
  // Clone element
  clone: function() {
    var clone
    
    /* if this is a wrapped shape */
    if (this instanceof SVG.Wrap) {
      /* build new wrapped shape */
      clone = this.parent[this.child.node.nodeName]()
      clone.attrs = this.attrs
      
      /* copy child attributes and transformations */
      clone.child.trans = this.child.trans
      clone.child.attr(this.child.attrs).transform({})
      
      /* re-plot shape */
      if (clone.plot)
        clone.plot(this.child.attrs[this.child instanceof SVG.Path ? 'd' : 'points'])
      
    } else {
      var name = this.node.nodeName
      
      /* invoke shape method with shape-specific arguments */
      clone = name == 'rect' ?
        this.parent[name](this.attrs.width, this.attrs.height) :
      name == 'ellipse' ?
        this.parent[name](this.attrs.rx * 2, this.attrs.ry * 2) :
      name == 'image' ?
        this.parent[name](this.src) :
      name == 'text' ?
        this.parent[name](this.content) :
      name == 'g' ?
        this.parent.group() :
        this.parent[name]()
      
      clone.attr(this.attrs)
    }
    
    /* copy transformations */
    clone.trans = this.trans
    
    /* apply attributes and translations */
    return clone.transform({})
  },
  // Remove element
  remove: function() {
    if (this.parent)
      this.parent.remove(this)
    return this
  },
  // Get parent document
  doc: function() {
    return this._parent(SVG.Doc)
  },
  // Get parent nested document
  nested: function() {
    return this._parent(SVG.Nested)
  },
  // Set svg element attribute
  attr: function(a, v, n) {
    if (arguments.length < 2) {
      /* apply every attribute individually if an object is passed */
      if (typeof a == 'object')
        for (v in a) this.attr(v, a[v])
      
      /* act as a getter for style attributes */
      else if (this._isStyle(a))
        return a == 'text' ?
                 this.content :
               a == 'leading' ?
                 this[a] :
                 this.style[a]
      
      /* act as a getter if the first and only argument is not an object */
      else
        return this.attrs[a]
    
    } else if (v === null) {
      /* remove value */
      this.node.removeAttribute(a)
      
    } else {
      /* store value */
      this.attrs[a] = v
      
      /* treat x differently on text elements */
      if (a == 'x' && this._isText()) {
        for (var i = this.lines.length - 1; i >= 0; i--)
          this.lines[i].attr(a, v)
      
      /* set the actual attribute */
      } else {
        /* BUG FIX: some browsers will render a stroke if a color is given even though stroke width is 0 */
        if (a == 'stroke-width')
          this.attr('stroke', parseFloat(v) > 0 ? this.attrs.stroke : null)
        
        /* set give attribute on node */
        n != null ?
          this.node.setAttributeNS(n, a, v) :
          this.node.setAttribute(a, v)
      }
      
      /* if the passed argument belongs to the style as well, add it there */
      if (this._isStyle(a)) {
        a == 'text' ?
          this.text(v) :
        a == 'leading' ?
          this[a] = v :
          this.style[a] = v
      
        this.text(this.content)
      }
    }
    
    return this
  },
  // Manage transformations
  transform: function(o) {
    /* act as a getter if the first argument is a string */
    if (typeof o === 'string')
      return this.trans[o]
      
    /* ... otherwise continue as a setter */
    var key, transform = []
    
    /* merge values */
    for (key in o)
      if (o[key] != null)
        this.trans[key] = o[key]
    
    /* alias current transformations */
    o = this.trans
    
    /* add rotation */
    if (o.rotation != 0) {
      var box = this.bbox()
      transform.push('rotate(' + o.rotation + ',' + (o.cx != null ? o.cx : box.cx) + ',' + (o.cy != null ? o.cy : box.cy) + ')')
    }
    
    /* add scale */
    transform.push('scale(' + o.scaleX + ',' + o.scaleY + ')')
    
    /* add skew on x axis */
    if (o.skewX != 0)
      transform.push('skewX(' + o.skewX + ')')
    
    /* add skew on y axis */
    if (o.skewY != 0)
      transform.push('skewY(' + o.skewY + ')')
    
    /* add translation */
    transform.push('translate(' + o.x + ',' + o.y + ')')
    
    /* add only te required transformations */
    return this.attr('transform', transform.join(' '))
  },
  // Store data values on svg nodes
  data: function(a, v, r) {
    if (arguments.length < 2) {
      try {
        return JSON.parse(this.attr('data-' + a))
      } catch(e) {
        return this.attr('data-' + a)
      }
      
    } else {
      this.attr('data-' + a, v === null ? null : r === true ? v : JSON.stringify(v))
    }
    
    return this
  },
  // Get bounding box
  bbox: function() {
    return new SVG.BBox(this)
  },
  // Checks whether the given point inside the bounding box of the element
  inside: function(x, y) {
    var box = this.bbox()
    
    return x > box.x &&
           y > box.y &&
           x < box.x + box.width &&
           y < box.y + box.height
  },
  // Show element
  show: function() {
    this.node.style.display = ''
    
    return this
  },
  // Hide element
  hide: function() {
    this.node.style.display = 'none'
    
    return this
  },
  // Is element visible?
  visible: function() {
    return this.node.style.display != 'none'
  },
  // Private: find svg parent by instance
  _parent: function(parent) {
    var element = this
    
    while (element != null && !(element instanceof parent))
      element = element.parent

    return element
  },
  // Private: tester method for style detection
  _isStyle: function(attr) {
    return typeof attr == 'string' && this._isText() ? (/^font|text|leading/).test(attr) : false
  },
  // Private: element type tester
  _isText: function() {
    return this instanceof SVG.Text
  }
  
})
