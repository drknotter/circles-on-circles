class Link {
  constructor(l1, l2, c1, c2) {
    this.l1 = l1;
    this.l2 = l2;
    this.c1 = c1;
    this.c2 = c2;

    this.joint = canvasSvg.circle(0, 0, 0);
    this.line1 = canvasSvg.line(0,0,0,0);
    this.line2 = canvasSvg.line(0,0,0,0);

    this.joint.attr({
      'fill': '#000000',
      'r': '5px'
    });
    this.line1.attr({
      'stroke': '#000000',
      'stroke-width': '2px'
    });
    this.line2.attr({
      'stroke': '#000000',
      'stroke-width': '2px'
    });

    this.p = {'x': 0, 'y': 0};

    this.update(0);
  }

  update(t) {
    var offset = {
      'x': this.c2.center.cx - this.c1.center.cx,
      'y': this.c2.center.cy - this.c1.center.cy
    }

    var d = Math.sqrt(offset.x * offset.x + offset.y * offset.y);
    var sinTheta = Math.sqrt(4 * this.l1 * this.l1 * d * d - (this.l1 * this.l1 + d * d - this.l2 * this.l2) * (this.l1 * this.l1 + d * d - this.l2 * this.l2)) 
      / (2 * this.l1 * d);
    var cosTheta = (this.l1 * this.l1 + d * d - this.l2 * this.l2) / (2 * this.l1 * d);

    this.p = {
      'x': this.l1 / d * (cosTheta * offset.x - sinTheta * offset.y) + this.c1.center.cx,
      'y': this.l1 / d * (sinTheta * offset.x + cosTheta * offset.y) + this.c1.center.cy
    }

    this.p.x = this.p.x ? this.p.x : 0;
    this.p.y = this.p.y ? this.p.y : 0;

    this.joint.attr({
      'cx': this.p.x,
      'cy': this.p.y
    })
    this.line1.attr({
      'x1': this.c1.center.cx,
      'y1': this.c1.center.cy,
      'x2': this.p.x,
      'y2': this.p.y
    })
    this.line2.attr({
      'x1': this.c2.center.cx,
      'y1': this.c2.center.cy,
      'x2': this.p.x,
      'y2': this.p.y
    })
  }
}
