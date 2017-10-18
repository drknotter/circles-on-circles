class Circle {
  constructor(r, initialTheta, dTheta, prev, attr) {
    this.r = r;
    this.center = {'cx': 0, 'cy': 0};

    this.initialTheta = initialTheta,
    this.theta = this.initialTheta;
    this.dTheta = dTheta,
    this.prev = prev;

    this.circle = canvasSvg.circle(0, 0, 0);
    if (attr) {
      this.circle.attr(attr);
    } else {
      this.circle.attr({
        'fill': 'none',
        'stroke': '#000000',
        'stroke-width': '2px'
      });
    }

    this.update(0);
  }

  update(t) {
    this.theta = this.dTheta * t;
    if (this.prev) {
      this.theta += this.prev.theta;
      this.center.cx = this.prev.center.cx + this.prev.r * Math.cos(this.prev.theta + this.initialTheta);
      this.center.cy = this.prev.center.cy + this.prev.r * Math.sin(this.prev.theta + this.initialTheta);
    }

    this.circle.attr({
      'cx': this.center.cx,
      'cy': this.center.cy
    });
    this.circle.attr({'r': this.r});
  }
}

