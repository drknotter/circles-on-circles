var defaultParameters = {"r0":400,"r10":50,"r11":50,"r20":50,"r21":50,"s0":0.1,"s10":30,"s11":0,"s20":30,"s21":0,"a10":0,"a11":0,"a12":0,"a20":0.57,"a21":0,"a22":0,"l1":220,"l2":220,"startTime":0,"endTime":62.83,"resolution":240,"timeMultiplier":1,"circleDepth":2};
var handlePointerTemplate = '<span class="handlePointer"><div style="transform: translateX(-50%); width: 15px;">&#x25bc;</div><table class="handlePointerOptions"><tr><td><div class="handleAction deleteHandle">&#x232b;</div></td><td><div class="handleAction copyHandle">&#x2398</div></td><td><div class="handleAction editHandle">&#x270E;</div></td></tr></table></span>';
var radiusInputTemplate = '<tr><td><input class="setting" type="number"></td></tr>';
var angleSpeedInputTemplate = '<tr><td><input class="setting" type="number" step="0.01"></td></tr>';

var SVG_SIZE = 500;
var SVG_MARGIN = 25;
var SVG_HEADER = "<?xml version=\"1.0\" standalone=\"no\"?><!DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 1.1//EN\" \"http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd\"><svg xmlns=\"http://www.w3.org/2000/svg\" version=\"1.1\" width=\"" + SVG_SIZE + "\" height=\"" + SVG_SIZE + "\" viewBox=\"0 0 " + SVG_SIZE + " " + SVG_SIZE + "\">";
var SVG_PATH_HEADER = "<path d=\"M";
var SVG_PATH_FOOTER = "\" fill=\"none\" stroke=\"black\" stroke-width=\"1\"/>";
var SVG_FOOTER = "</svg>";

var N = 2;
var M = 3;

var canvasSvg;
var canvasPaint;
var lineColor = 'rgba(0, 0, 0, 0.3)';
var circleDepth;
var circles;
var link;

var isAnimating = false;
var isShowing = true;
var startTime = 0;
var endTime = 0;
var startTimestamp = 0;
var lastTimestamp = 0;
var lastPoint;
var currentSettingsId;
var colorHandles = [];
var currentDraggingHandle;

var cachedPath = null;

var colorPickerHue = 180;
var colorPickerSaturation = 50;
var colorPickerLightness = 25;
var colorPickerAlpha = 200;
var colorPickerOffset = 0;
var currentColorPickerTarget;
var currentResolution = 240;

$(window).on('load', function() {
  $(window).resize(handleResize);
  handleResize();
  toggleSettingsTray();
  restoreParameters();
  update($('#startTime').val(), true);
});

$( document ).ready(function() {
  var circlesSvg = Snap("#circles");
  canvasSvg = circlesSvg.g();
  canvasPaint = document.getElementById('paint').getContext('2d');

  document.getElementById('hueSaturation').width = 180;
  document.getElementById('hueSaturation').height = 180;
  document.getElementById('lightness').width = 40;
  document.getElementById('lightness').height = 180;
  document.getElementById('alpha').width = 40;
  document.getElementById('alpha').height = 180;

  $('#animate').click(function(event) {
    stopRendering();
     if (!isAnimating) {
      startAnimation();
    } else {
      stopAnimation();
    }
  });
  $('#hide').click(function(event) {
    isShowing = !isShowing;
    if (isShowing) {
      $('#circles').fadeIn(200);
      $(this).html('Hide Mechanics');
    } else {
      $('#circles').fadeOut(200);
      $(this).html('Show Mechanics');
    }
  });
  $('#render').click(function(event) {
    stopAnimation();
    if (!isRendering) {
      startRendering();
    } else {
      stopRendering();
    }
  });
  $('#render_svg').click(function(event) {
    stopAnimation();
    stopRendering();
    renderSvg()
  });
  $('#save').click(function(event) {
    stopAnimation();
    stopRendering();
    var appData = getAppData();
    var parametersName = prompt("Sketch name", appData.currentParametersName ? appData.currentParametersName : "My Sketch");
    saveParameters(parametersName);
    restoreParameters();
    updateParameters();
  });
  $('#manage').click(function(event) {
    stopAnimation();
    stopRendering();
    clearPaint();
    update(Number($('#startTime').val()));
    $('#settingsManagerBackground').show();
    $('#settingsManager').empty();
    var appData = getAppData();
    for (let i in appData.parameters) {
      var setting = $(renderSetting(i));
      setting.find('.open>div').click(function(event) {
        var appData = getAppData();
        appData.currentParametersName = $(this).attr('data-name');
        localStorage['circles-on-circles'] = JSON.stringify(appData);
        restoreParameters();
        update(Number($('#startTime').val()));
        $('#settingsManagerBackground').hide();
      });
      setting.find('.delete>div').click(function(event) {
        var name = $(this).attr('data-name');
        if (confirm("Really delete " + name + "?")) {
          var appData = getAppData();
          delete appData.parameters[name];
          if (appData.currentParametersName == name) {
            delete appData.currentParametersName;
          }
          localStorage['circles-on-circles'] = JSON.stringify(appData);
          $('#settingsManagerBackground').hide();
        }
      });
      $('#settingsManager').append(setting);
    }
  });
  $('#settingsManagerBackground').hide();
  $('#settingsManagerBackground').click(function(event) {
    $(this).hide();
  });
  $('#settingsManagerContainer').click(function(event) {
    event.stopPropagation();
  });

  $('#settingsToggle').click(function(event) {
    toggleSettingsTray();
  });
  $('#settings').on('mouseenter', function(event) {
    openSettingsTray();
  })
  $('#settings').on('mouseleave', function(event) {
    closeSettingsTray();
  })

  $('#handlePointerGroup').click(function(event) {
    if (event.target.id === 'handlePointerGroup') {
      if (isRendering || isAnimating) {
        return;
      }
      addColorHandle(event.offsetX / $(event.currentTarget).width());
    }
  });
  $('body').on('mouseup', function() {
    $('body').removeClass('noselect');
    $('body').off('mousemove');
    currentDraggingHandle = null;
  });
  $('body').on('mouseleave', function(event) {
    $('body').removeClass('noselect');
    $('body').off('mousemove');
    currentDraggingHandle = null;
  });

  paintColorGradient();
  paintColorPicker();
  initializeColorPickerHandlers();
  $('#colorPickerContainer').hide();
  $('#colorPickerContainer').click(function(event) {
    $('#colorPickerContainer').hide();
  });
  $('#colorPicker').click(function(event) {
    event.stopPropagation();
  });
});

function getAppData() {
  var appData = localStorage['circles-on-circles'] ? JSON.parse(localStorage['circles-on-circles']) : {'parameters':{}};
  return appData;
}

function getCurrentParameters() {
  var appData = getAppData();
  var parameters = appData.currentParametersName && appData.parameters[appData.currentParametersName] ? appData.parameters[appData.currentParametersName] : defaultParameters;
  return {
    'name': appData.currentParametersName || "New Sketch",
    'parameters': parameters
  };
}

function initialize() {
  initializeCircles();
  initializeInputs();
  initializeFocusHandlers();
}

function initializeCircles() {
  canvasSvg.clear();
  circles = [];

  circles.push(new Circle(0, 0, 0, null));
  for (let i=0; i<circleDepth+1; i++) {
    circles.push(new Circle(i==circleDepth ? 5 : 0, 0, 0, circles[circles.length - 1], i==circleDepth ? {} : false));
  }

  for (let i=0; i<circleDepth+1; i++) {
    circles.push(new Circle(i==circleDepth ? 5 : 0, 0, 0, circles[i==0 ? 0 : circles.length - 1], i==circleDepth ? {} : false));
  }

  link = new Link(0, 0, circles[circleDepth+1], circles[2 * (circleDepth+1)]);
}

function initializeInputs() {
  $('#radii').find('td').parent().remove();
  $('#angles').find('td').parent().remove();
  $('#speeds').find('td').parent().remove();
  addCircleInput(radiusInputTemplate, 'r0', $('#radii'));
  addCircleInput(angleSpeedInputTemplate, 's0', $('#speeds'));
  for (let i=1; i<=2; i++) {
    for (let j=0; j<circleDepth+1; j++) {
      if (j<circleDepth) {
        addCircleInput(radiusInputTemplate, ('r'+i)+j, $('#radii'));
        addCircleInput(angleSpeedInputTemplate, ('s'+i)+j, $('#speeds'));
      }
      addCircleInput(angleSpeedInputTemplate, ('a'+i)+j, $('#angles'));
    }
  }
  $('.setting').change(function(event) {
    stopAnimation(true);
    stopRendering(true);
    updateParameters();
  });
}

function addCircleInput(template, id, parent) {
  let row = $(template);
  row.find('input').attr('id', id);
  parent.append(row);
}

function initializeFocusHandlers() {
  var focusMap = {
    '#r0':circles[0].circle,
    '#s0':circles[0].circle,
    '#l1':link.line1,
    '#l2':link.line2,
  };
  for (let i=1; i<=2; i++) {
    for (let j=0; j<circleDepth + 1; j++) {
      if (j<circleDepth) {
        focusMap[('#r'+i)+j] = circles[(i - 1) * (circleDepth + 1) + (j + 1)].circle;
        focusMap[('#s'+i)+j] = circles[(i - 1) * (circleDepth + 1) + (j + 1)].circle;
      }
      focusMap[('#a'+i)+j] = circles[(i - 1) * (circleDepth + 1) + (j + 1)].circle;
    }
  }
  for (let id in focusMap) {
    $(id).focus(function(event) {
      if (!isAnimating && !isRendering) {
        focusSvgElement(focusMap[id]);
      }
    });
    $(id).blur(function(event) {
      blurSvgElement(focusMap[id]);
    });
  }
}

function updateParameters() {
  var newCircleDepth = Number($('#circleDepth').val());
  if (newCircleDepth != circleDepth) {
    var cachedParameters = jsonifyCurrentParameters();
    circleDepth = Math.max(Math.min(newCircleDepth, 5), 1);
    initialize();
    restoreFrom($('#settingsName').html(), cachedParameters);
  }

  circles[0].r = Number($('#r0').val());
  circles[0].dTheta = Number($('#s0').val());
  // circles[1].r = Number($('#r10').val());
  // circles[2].r = Number($('#r11').val());
  // circles[4].r = Number($('#r20').val());
  // circles[5].r = Number($('#r21').val());
  // circles[1].dTheta = Number($('#s10').val());
  // circles[2].dTheta = Number($('#s11').val());
  // circles[4].dTheta = Number($('#s20').val());
  // circles[5].dTheta = Number($('#s21').val());
  // circles[1].initialTheta = Number($('#a10').val());
  // circles[2].initialTheta = Number($('#a11').val());
  // circles[3].initialTheta = Number($('#a12').val());
  // circles[4].initialTheta = Number($('#a20').val());
  // circles[5].initialTheta = Number($('#a21').val());
  // circles[6].initialTheta = Number($('#a22').val());
  for (let i=1; i<=2; i++) {
    for (let j=0; j<circleDepth + 1; j++) {
      if (j<circleDepth) {
        circles[(i - 1) * (circleDepth + 1) + (j + 1)].r = Number($(('#r'+i)+j).val());
        circles[(i - 1) * (circleDepth + 1) + (j + 1)].dTheta = Number($(('#s'+i)+j).val());
      }
      circles[(i - 1) * (circleDepth + 1) + (j + 1)].initialTheta = Number($(('#a'+i)+j).val());
    }
  }
  link.l1 = Number($("#l1").val());
  link.l2 = Number($("#l2").val());
  currentResolution = Number($('#resolution').val());
  currentResolution = Math.max(currentResolution, 0);
  $('#resolution').val(currentResolution);
  currentTimeMultiplier = Number($('#timeMultiplier').val());
  currentTimeMultiplier = Math.max(currentTimeMultiplier, 0);
  $('#timeMultiplier').val(currentTimeMultiplier);

  update(Number($('#startTime').val()));
}

function saveParameters(name) {
  var appData = getAppData();
  appData.currentParametersName = name;
  appData.parameters[name] = jsonifyCurrentParameters();
  localStorage['circles-on-circles'] = JSON.stringify(appData);
}

function jsonifyCurrentParameters() {
  var parameters = {
    'r0': circles[0].r,
    's0': circles[0].dTheta,
    // 'r10': circles[1].r,
    // 'r11': circles[2].r,
    // 'r20': circles[4].r,
    // 'r21': circles[5].r,
    // 's10': circles[1].dTheta,
    // 's11': circles[2].dTheta,
    // 's20': circles[4].dTheta,
    // 's21': circles[5].dTheta,
    // 'a10': circles[1].initialTheta,
    // 'a11': circles[2].initialTheta,
    // 'a12': circles[3].initialTheta,
    // 'a20': circles[4].initialTheta,
    // 'a21': circles[5].initialTheta,
    // 'a22': circles[6].initialTheta,
    'l1': link.l1,
    'l2': link.l2,
    'startTime': Number($('#startTime').val()),
    'endTime': Number($('#endTime').val()),
    'colorHandles': colorHandles,
    'resolution': Number($('#resolution').val()),
    'timeMultiplier': Number($('#timeMultiplier').val()),
    'circleDepth': circleDepth,
  };

  for (let i=1; i<=2; i++) {
    for (let j=0; j<circleDepth + 1; j++) {
      if (j<circleDepth) {
        parameters[('r'+i)+j] = circles[(i - 1) * (circleDepth + 1) + (j + 1)].r;
        parameters[('s'+i)+j] = circles[(i - 1) * (circleDepth + 1) + (j + 1)].dTheta;
      }
      parameters[('a'+i)+j] = circles[(i - 1) * (circleDepth + 1) + (j + 1)].initialTheta;
    }
  }

  return parameters;
}

function restoreParameters() {
  var currentParameters = getCurrentParameters();
  circleDepth = Math.max(Math.min(currentParameters.parameters.circleDepth || 2, 5), 1);

  var parameters = currentParameters.parameters;
  var name = currentParameters.name;

  initialize();
  restoreFrom(name, parameters);
}

function restoreFrom(name, parameters) {
  circles[0].r = parameters.r0;
  circles[0].dTheta = parameters.s0;

  for (let i=1; i<=2; i++) {
    for (let j=0; j<circleDepth + 1; j++) {
      if (j<circleDepth) {
        circles[(i - 1) * (circleDepth + 1) + (j + 1)].r = parameters[('r'+i)+j] || 20;
        circles[(i - 1) * (circleDepth + 1) + (j + 1)].dTheta = parameters[('s'+i)+j] || 0;
      }
      circles[(i - 1) * (circleDepth + 1) + (j + 1)].initialTheta = parameters[('a'+i)+j] || 0;
    }
  }
  link.l1 = parameters.l1;
  link.l2 = parameters.l2;
  currentResolution = parameters.resolution || 240;
  currentTimeMultiplier = parameters.timeMultiplier || 1;

  $('#r0').val(parameters.r0);
  $('#s0').val(parameters.s0);
  // $('#r10').val(parameters.r10);
  // $('#r11').val(parameters.r11);
  // $('#r20').val(parameters.r20);
  // $('#r21').val(parameters.r21);
  // $('#s10').val(parameters.s10);
  // $('#s11').val(parameters.s11);
  // $('#s20').val(parameters.s20);
  // $('#s21').val(parameters.s21);
  // $('#a10').val(parameters.a10);
  // $('#a11').val(parameters.a11);
  // $('#a12').val(parameters.a12);
  // $('#a20').val(parameters.a20);
  // $('#a21').val(parameters.a21);
  // $('#a22').val(parameters.a22);
  for (let i=1; i<=2; i++) {
    for (let j=0; j<circleDepth + 1; j++) {
      if (j < circleDepth) {
        $(('#r'+i)+j).val(parameters[('r'+i)+j] || 20);
        $(('#s'+i)+j).val(parameters[('s'+i)+j] || 0);
      }
      $(('#a'+i)+j).val(parameters[('a'+i)+j] || 0);
    }
  }
  $('#l1').val(parameters.l1);
  $('#l2').val(parameters.l2);
  $('#startTime').val(parameters.startTime);
  $('#endTime').val(parameters.endTime);
  $('#resolution').val(currentResolution);
  $('#timeMultiplier').val(currentTimeMultiplier);
  $('#circleDepth').val(circleDepth);

  $('#settingsName').html(name);

  colorHandles = [];
  $('.handlePointer').remove();
  for (i in parameters.colorHandles) {
    colorHandles.push(new ColorHandle(
      parameters.colorHandles[i].offset,
      parameters.colorHandles[i].h,
      parameters.colorHandles[i].s,
      parameters.colorHandles[i].l,
      parameters.colorHandles[i].a));
    addHandlePointer(colorHandles[i], true);
  }
  paintColorGradient();
}

function update(t, setInput) {
  for (let i=0; i<circles.length; i++) {
    circles[i].update(t);
  }
  link.update(t);

  if (setInput) {
    var tFrac = (t-startTime) / (endTime - startTime) * 100;
    $('#currentTimePointer').css({
      'left': tFrac + '%'
    });
  }
}

function paintPath(t) {
  if (lastPoint) {
    canvasPaint.beginPath();
    canvasPaint.moveTo(lastPoint.x, lastPoint.y);
    canvasPaint.lineTo(link.p.x, link.p.y);
    canvasPaint.strokeStyle = colorFromTime(t);
    canvasPaint.stroke();
  } else {
    cachedPath = [];
  }
  lastPoint = link.p;
  cachedPath.push(lastPoint);
}

var currentAnimationTime;
var currentTimeMultiplier;
function startAnimation() {
  isAnimating = true;
  clearPaint();
  hideHandlePointerOptions();
  startTime = Number($('#startTime').val());
  endTime = Number($('#endTime').val());
  currentTimeMultiplier = Number($('#timeMultiplier').val());
  currentAnimationTime = startTime;
  startTimestamp = performance.now();
  update(startTime, true);
  requestAnimationFrame(animate);
  $('#animate').html("Stop Animation");
}

function stopAnimation(doClearPaint) {
  isAnimating = false;
  if (doClearPaint) {
    clearPaint();
  }
  $('#animate').html("Start Animation");
}

function animate(timestamp) {
  if (!isAnimating) {
    return;
  }

  var first = true;
  while (currentAnimationTime - startTime < (timestamp - startTimestamp) / 1000 
    && currentAnimationTime - startTime < currentTimeMultiplier * (endTime - startTime)) {
    update((currentAnimationTime - startTime) / currentTimeMultiplier + startTime, first);
    paintPath((currentAnimationTime - startTime) / currentTimeMultiplier + startTime);
    currentAnimationTime += 1 / currentResolution;
    first = false;
  }

  if (currentAnimationTime - startTime < currentTimeMultiplier * (endTime - startTime)) {
    requestAnimationFrame(animate);
  } else {
    stopAnimation();
  }
}

var isRendering;
var currentRenderTime;
function startRendering() {
  isRendering = true;
  clearPaint();
  hideHandlePointerOptions();
  startTime = currentRenderTime = Number($('#startTime').html());
  endTime = Number($('#endTime').val());
  setTimeout(renderSegment);
  $('#render').html('Stop Render');
}

function stopRendering(doClearPaint) {
  isRendering = false;
  if (doClearPaint) {
    clearPaint();
  }
  $('#render').html('Start Render');
}

function renderSegment() {
  if (!isRendering) {
    return;
  }

  var startSegmentRenderTime = currentRenderTime;
  var first = true;
  renderSegmentDuration = 96 / currentResolution;
  while (currentRenderTime < startSegmentRenderTime + renderSegmentDuration && currentRenderTime < endTime) {
    update(currentRenderTime, first);
    paintPath(currentRenderTime);
    currentRenderTime += 1 / currentResolution;
    first =false;
  }

  if (currentRenderTime < endTime) {
    setTimeout(renderSegment);
  } else {
    stopRendering();
  }
}

function renderSvg() {
  if (!cachedPath) {
    return;
  }
  var boundingBox = [1e10, 1e10, -1e10, -1e10];
  for (let i=0; i<cachedPath.length; i++) {
    boundingBox[0] = Math.min(boundingBox[0], cachedPath[i].x);
    boundingBox[1] = Math.min(boundingBox[1], cachedPath[i].y);
    boundingBox[2] = Math.max(boundingBox[2], cachedPath[i].x);
    boundingBox[3] = Math.max(boundingBox[3], cachedPath[i].y);
  }
  var scale = Math.min((SVG_SIZE - 2 * SVG_MARGIN) / (boundingBox[2] - boundingBox[0]), (SVG_SIZE - 2 * SVG_MARGIN) / (boundingBox[3] - boundingBox[1]));

  var svg_string = SVG_HEADER + SVG_PATH_HEADER;
  for (let i=0; i<cachedPath.length; i++) {
    let p = [cachedPath[i].x, cachedPath[i].y];
    for (let d=0; d<2; d++) {
      p[d] -= boundingBox[d];
      p[d] *= scale;
      p[d] += SVG_MARGIN;
    }
    svg_string += p[0].toString() + ' ' + p[1].toString() + (i < cachedPath.length - 1 ? 'L' : '');
  }
  svg_string += SVG_PATH_FOOTER + SVG_FOOTER;

  let appData = getAppData();
  var file = new Blob([svg_string], {type: 'text/plain'});

  var a = document.createElement("a");
  var url = URL.createObjectURL(file);
  a.href = url;
  a.download = (appData.currentParametersName ? appData.currentParametersName : 'New Sketch') + '.svg';
  document.body.appendChild(a);
  a.click();
  setTimeout(function() {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);  
  }, 0);
}

function clearPaint() {
  canvasPaint.setTransform(1, 0, 0, 1, 0, 0);
  canvasPaint.clearRect(
    0,
    0,
    canvasPaint.canvas.width,
    canvasPaint.canvas.height);
  handleResize();
  lastPoint = null;
}

function handleResize() {
  var width = $('body').width();
  var height = $('body').height();

  canvasSvg.transform('T'+(width/2)+','+(height/2));
  canvasPaint.canvas.width = width;
  canvasPaint.canvas.height = height;
  canvasPaint.setTransform(1, 0, 0, 1, width/2, height/2);

  var factor = 0.9 * Math.min(width, height) / (2 * defaultParameters.r0);
  defaultParameters.r0 *= factor;
  defaultParameters.r10 *= factor;
  defaultParameters.r11 *= factor;
  defaultParameters.r20 *= factor;
  defaultParameters.r21 *= factor;
  defaultParameters.l1 *= factor;
  defaultParameters.l2 *= factor;
}

function renderSetting(name) {
  var html = '';
  html += '<tr>';
  html += '<td class="name">' + name + '</td>';
  html += '<td class="control open"><div data-name="' + name + '">Open</div></td>'
  html += '<td class="control delete"><div data-name="' + name + '">&#x232b;</div></td>'
  html += '</tr>';
  return html;
}

function colorFromTime(t) {
  var tFrac = (t - startTime) / (endTime - startTime);
  return 'hsla(' + componentFromTimeFraction('h', tFrac) + ',' + componentFromTimeFraction('s', tFrac) + '%,' + componentFromTimeFraction('l', tFrac) + '%,' + (componentFromTimeFraction('a', tFrac)/255) + ')';
}
function componentFromTimeFraction(c, t) {
  var i = colorHandles.findIndex(function(h) { return h.offset > t});
  var x0 = colorHandles.length == 0 ? (c == 'a' ? 255 : 0) : (i == 0 ? (c == 'a' ? 255 : 0) : (i == -1 ? colorHandles[colorHandles.length - 1][c] : colorHandles[i-1][c]));
  var t0 = colorHandles.length == 0 ? 0 : (i == 0 ? 0 : (i == -1 ? colorHandles[colorHandles.length - 1].offset : colorHandles[i-1].offset));
  var x1 = i != -1 ? colorHandles[i][c] : (c == 'a' ? 255 : 0);
  var t1 = i != -1 ? colorHandles[i].offset : 1;

  if (c=='h') {
    if (x0 < x1 && x0 + 360 - x1 < x1 - x0) {
      x0 += 360;
    } else if (x1 < x0 && x1 + 360 - x0 < x0 - x1) {
      x1 += 360;
    }
  }

  var component = interpolate(x0, t0, x1, t1, t);

  if (c=='h') {
    component %= 360;
  }

 return component;
}

function interpolate(x0, t0, x1, t1, t) {
  return ((x1-x0)/(t1-t0))*(t-t0) + x0;
}

function focusSvgElement(svgElement) {
  svgElement.attr({
    'stroke': '#ff0000',
    'stroke-width': '4px'
  });
}
function blurSvgElement(svgElement) {
  svgElement.attr({
    'stroke': '#000000',
    'stroke-width': '2px'
  });
}

var isSettingsTrayShowing = true;
function toggleSettingsTray() {
  isSettingsTrayShowing = !isSettingsTrayShowing;
  var width = $('#settings').outerWidth(true);
  $('#settings').css({
    'transform': 'translateX(-' + (isSettingsTrayShowing ? 0 : width - 50) + 'px)'
  });
  $('#settingsToggle').html(isSettingsTrayShowing ? '&#x25C1;' : '&#x25B6;');
}

function openSettingsTray() {
  isSettingsTrayShowing = false;
  toggleSettingsTray();
}

function closeSettingsTray() {
  isSettingsTrayShowing = true;
  toggleSettingsTray();
}

function paintColorGradient() {
  var gradientCtx = document.getElementById('gradient').getContext('2d');
  var width = gradientCtx.canvas.width;
  var height = gradientCtx.canvas.height;
  var imageData = gradientCtx.getImageData(0, 0, width, height);
  for (let i=0; i<width; i++) {
    var color = [componentFromTimeFraction('h', i/width), componentFromTimeFraction('s', i/width), componentFromTimeFraction('l', i/width), componentFromTimeFraction('a', i/width)];
    hslaToRgba(color);
    for (let j=0; j<height; j++) {
      for (let c=0; c<4; c++) {
        imageData.data[j*width*4 + i*4 + c] = color[c];
      }
    }
  }
  gradientCtx.putImageData(imageData,0,0);
}

function paintColorPicker() {
  var pickerContexts = {
    'hueSaturation': document.getElementById('hueSaturation').getContext('2d'),
    'lightness': document.getElementById('lightness').getContext('2d'),
    'alpha': document.getElementById('alpha').getContext('2d')
  };

  // Paint the colors.
  for (let p in pickerContexts) {
    let ctx = pickerContexts[p];
    let width = ctx.canvas.width;
    let height = ctx.canvas.height;
    let imageData = ctx.getImageData(0, 0, width, height);
    for (let i=0; i<width; i++) {
      for (let j=0; j<height; j++) {
        let color = colorForPicker(p, i, j, width, height);
        hslaToRgba(color);
        for (let c=0; c<4; c++) {
          imageData.data[j*width*4 + i*4 + c] = color[c];
        }
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }

  // Paint the current selections.
  for (let p in pickerContexts) {
    let ctx = pickerContexts[p];
    let width = ctx.canvas.width;
    let height = ctx.canvas.height;
    let position = positionForPicker(p, width, height);
    ctx.lineWidth = 3;
    ctx.strokeStyle = colorPickerLightness > 50 ? '#000' : '#fff';
    ctx.beginPath();
    ctx.arc(position.x, position.y, 7, 0, 2*Math.PI, false);
    ctx.stroke();
  }

  var color = [colorPickerHue, colorPickerSaturation, colorPickerLightness, colorPickerAlpha];
  hslaToRgba(color);
  $('#currentPickerColor').css('background', 'rgba(' + color[0] + ',' + color[1] + ',' + color[2] + ',' + (color[3]/255) + ')');
}

function initializeColorPickerHandlers() {
  var pickerIds = ['hueSaturation', 'lightness', 'alpha'];
  for (let i=0; i<pickerIds.length; i++) {
    $('#'+pickerIds[i]).on('mousemove', function(event) {
      var p = positionForPicker(pickerIds[i], this.width, this.height);
      if (Math.abs(event.offsetX - p.x) < 9 && Math.abs(event.offsetY - p.y) < 7) {
        this.style.cursor = 'all-scroll';
        $(this).data('hover', true);
      } else {
        this.style.cursor = 'auto';
        $(this).data('hover', false);
      }

      if($(this).data('dragging')) {
        setPickerValue(pickerIds[i], event.offsetX, event.offsetY, this.width, this.height);
        updateColorPicker();
      }
    });
    $('#'+pickerIds[i]).on('mousedown', function(event) {
      $('body').addClass('noSelect');
      $(this).data('dragging', true);
      setPickerValue(pickerIds[i], event.offsetX, event.offsetY, this.width, this.height);
      updateColorPicker();
    });
    $('#'+pickerIds[i]).on('mouseup', function(event) {
      $(this).data('dragging', false);
    });
    $('#'+pickerIds[i]).on('mouseleave', function(event) {
      $(this).data('dragging', false);
    });
  }

  $('#redInput').change(updateColorPickerFromInputs);
  $('#greenInput').change(updateColorPickerFromInputs);
  $('#blueInput').change(updateColorPickerFromInputs);
  $('#alphaInput').change(updateColorPickerFromInputs);
  $('#offsetInput').change(updateColorPickerFromInputs);
}

function updateColorPickerFromInputs(event) {
  if (currentColorPickerTarget) {
    var color = [
      Number($('#redInput').val()),
      Number($('#greenInput').val()),
      Number($('#blueInput').val()),
      Number($('#alphaInput').val())];
    for (let i=0; i<4; i++) {
      color[i] = Math.max(Math.min(color[i], 255), 0);
    }
    rgbaToHsla(color);
    colorPickerHue = color[0];
    colorPickerSaturation = color[1];
    colorPickerLightness = color[2];
    colorPickerAlpha = color[3];
    colorPickerOffset = Number($('#offsetInput').val());
    updateColorPicker();
  }
}

function colorForPicker(pickerElement, i, j, width, height) {
  if (pickerElement == 'hueSaturation') {
    return [360 * i / width, 100 * (height-j) / height, colorPickerLightness, colorPickerAlpha];
  } else if (pickerElement == 'lightness') {
    return [colorPickerHue, colorPickerSaturation, 100 * (height-j) / height, colorPickerAlpha];
  } else if (pickerElement == 'alpha') {
    return [colorPickerHue, colorPickerSaturation, colorPickerLightness, 255 * (height-j) / height];
  }
}

function positionForPicker(pickerElement, width, height) {
  var x, y;

  if (pickerElement == 'hueSaturation') {
    x = width * colorPickerHue / 360,
    y = height * (1 - colorPickerSaturation / 100);
  } else if (pickerElement == 'lightness') {
    x = width / 2;
    y = height * (1 - colorPickerLightness / 100);
  } else if (pickerElement == 'alpha') {
    x = width / 2;
    y = height * (1 - colorPickerAlpha / 255);
  }

  return {'x': x, 'y': y};
}

function setPickerValue(pickerElement, x, y, width, height) {
  if (pickerElement == 'hueSaturation') {
    colorPickerHue = 360 * x / width;
    colorPickerSaturation = 100 * (height - y) / height;
  } else if (pickerElement == 'lightness') {
    colorPickerLightness = 100 * (height - y) / height;
  } else if (pickerElement == 'alpha') {
    colorPickerAlpha = 255 * (height - y) / height;
  }
}

function updateColorPicker() {
  if (currentColorPickerTarget) {
    pinColorPickerValues();
    currentColorPickerTarget.data('handle').h = colorPickerHue;
    currentColorPickerTarget.data('handle').s = colorPickerSaturation;
    currentColorPickerTarget.data('handle').l = colorPickerLightness;
    currentColorPickerTarget.data('handle').a = colorPickerAlpha;
    currentColorPickerTarget.data('handle').offset = colorPickerOffset;
    var color = [colorPickerHue, colorPickerSaturation, colorPickerLightness, colorPickerAlpha];
    hslaToRgba(color);
    $('#redInput').val(color[0]);
    $('#greenInput').val(color[1]);
    $('#blueInput').val(color[2]);
    $('#alphaInput').val(color[3]);
    $('#offsetInput').val(colorPickerOffset);
    currentColorPickerTarget.css('left', (100 * colorPickerOffset) + '%');
    sortColorHandles();
  }
  paintColorPicker();
}

function pinColorPickerValues() {
  colorPickerHue %= 360;
  if (colorPickerHue < 0) {
    colorPickerHue += 360;
  }
  colorPickerSaturation = Math.min(Math.max(colorPickerSaturation, 0), 100);
  colorPickerLightness = Math.min(Math.max(colorPickerLightness, 0), 100);
  colorPickerAlpha = Math.min(Math.max(colorPickerAlpha, 0), 255);
  colorPickerOffset = Math.min(Math.max(colorPickerOffset, 0), 1);
}

function hslaToRgba(color) {
  var hue = color[0];
  var saturation = color[1] / 100;
  var lightness = color[2] / 100;
  var chroma = (1-Math.abs(2 * lightness - 1)) * saturation;
  var huePrime = hue / 60;
  var x = chroma * (1 - Math.abs((huePrime % 2) - 1));
  var m = lightness - 0.5 * chroma;

  var s = Math.floor(huePrime);
  switch(s) {
    case 0:
      color[0] = chroma + m;
      color[1] = x + m;
      color[2] = m;
      break;
    case 1:
      color[0] = x + m;
      color[1] = chroma + m;
      color[2] = m;
      break;
    case 2:
      color[0] = m;
      color[1] = chroma + m;
      color[2] = x + m;
      break;
    case 3:
      color[0] = m;
      color[1] = x + m;
      color[2] = chroma + m;
      break;
    case 4:
      color[0] = x + m;
      color[1] = m;
      color[2] = chroma + m;
      break;
    case 5:
      color[0] = chroma + m;
      color[1] = m;
      color[2] = x + m;
      break;
  }

  for (let i=0; i<3; i++) {
    color[i] = Math.min(Math.round(color[i] * 255), 255);
  }
  color[3] = Math.floor(color[3]);
}

function rgbaToHsla(color) {
  var r = color[0] / 255;
  var g = color[1] / 255;
  var b = color[2] / 255;

  var M = Math.max(Math.max(r, g), b);
  var m = Math.min(Math.min(r, g), b);
  var C = M - m;
  var hPrime = 0;
  if (C > 0) {
    if (M == r) {
      hPrime = ((g - b) / C) % 6;
    } else if (M == g) {
      hPrime = (b - r) / C + 2; 
    } else if (M == b) {
      hPrime = (r - g) / C + 4;
    }
  }
  var L = 0.5 * (M + m);
  color[0] = 60 * hPrime;
  color[2] = L * 100;
  color[1] = L == 1 || L == 0 ? 0 : 100 * C / (1 - Math.abs(2 * L - 1));
}

function addColorHandle(offset, dontShowPicker) {
  colorPickerHue = componentFromTimeFraction('h', offset);
  colorPickerSaturation = componentFromTimeFraction('s', offset);
  colorPickerLightness = componentFromTimeFraction('l', offset);
  colorPickerAlpha = componentFromTimeFraction('a', offset);
  colorPickerOffset = offset;

  var colorHandle = new ColorHandle(offset, 
    colorPickerHue, 
    colorPickerSaturation, 
    colorPickerLightness, 
    colorPickerAlpha);
  colorHandles.push(colorHandle)
  addHandlePointer(colorHandle, dontShowPicker);
}

function addHandlePointer(colorHandle, dontShowPicker) {
  var handlePointer = $(handlePointerTemplate);
  handlePointer.data("handle", colorHandle);
  initializeHandlePointer(handlePointer);
  $('#handlePointerGroup').append(handlePointer);
  sortColorHandles();

  if (!dontShowPicker) {
    currentColorPickerTarget = handlePointer;
    $('#colorPickerContainer').show();
    updateColorPicker();
  }
}

var currentHoveringHandle;
var showHandlePointerOptionsId;
var hideHandlePointerOptionsId;
function initializeHandlePointer(handlePointer) {
  handlePointer.css('left', (handlePointer.data('handle').offset * 100) + '%');
  handlePointer.on('mousedown', function(event) {
    if (isRendering || isAnimating) {
      return;
    }
    $('body').addClass('noselect');
    $('body').on('mousemove', handleDrag);
    currentDraggingHandle = $(this);
    currentHoveringHandle = null;
    $(this).data('dragInfo', {
      'startPosition': handlePointer.position().left,
      'startScreenX': event.screenX,
      'downTime': event.timeStamp
    });
  });
  handlePointer.on('mouseenter', function(event) {
    clearTimeout(hideHandlePointerOptionsId)
    if (isRendering || isAnimating) {
      return;
    }
  });
  handlePointer.on('mouseleave', function(event) {
    hideHandlePointerOptionsId = setTimeout(hideHandlePointerOptions, 750);
  });
  handlePointer.on('click', function(event) {
    if (isRendering || isAnimating) {
      return;
    }
    if (event.timeStamp - $(this).data('dragInfo').downTime > 500) {
      return;
    }

    hideHandlePointerOptions();
    if ($(this).find('.handlePointerOptions').is(':hidden')) {
      currentHoveringHandle = $(this);
      showHandlePointerOptions($(this));
    } else {
      currentHoveringHandle = null;
    }
  })
  var options = handlePointer.find('.handlePointerOptions');
  options.hide();
  options.find('.editHandle').click(function(event) {
    if (isRendering || isAnimating) {
      return;
    }
    event.stopPropagation();
    currentColorPickerTarget = $(this).parents('.handlePointer').first();
    $('#colorPickerContainer').show();
    colorPickerHue = currentColorPickerTarget.data('handle').h;
    colorPickerSaturation = currentColorPickerTarget.data('handle').s;
    colorPickerLightness = currentColorPickerTarget.data('handle').l;
    colorPickerAlpha = currentColorPickerTarget.data('handle').a;
    colorPickerOffset = currentColorPickerTarget.data('handle').offset;
    updateColorPicker();
  });
  options.find('.deleteHandle').click(function(event) {
    if (isRendering || isAnimating) {
      return;
    }
    event.stopPropagation();
    let i = colorHandles.indexOf($(this).parents('.handlePointer').first().data('handle'));
    if (i > -1) {
      colorHandles.splice(i, 1);
      $(this).parents('.handlePointer').first().remove();
      paintColorGradient();
    }
  });
  options.find('.copyHandle').click(function(event) {
    if (isRendering || isAnimating) {
      return;
    }
    event.stopPropagation();
    addColorHandle($(this).parents('.handlePointer').first().data('handle').offset, true);
    clearTimeout(showHandlePointerOptionsId)
    hideHandlePointerOptionsId = setTimeout(hideHandlePointerOptions, 0);
  })
}

function showHandlePointerOptions() {
  if (currentHoveringHandle && !currentDraggingHandle) {
    currentHoveringHandle.find('.handlePointerOptions').show(200);
  }
}

function hideHandlePointerOptions() {
  $('.handlePointerOptions').hide(200);
}

function handleDrag() {
  hideHandlePointerOptions();
  if (currentDraggingHandle) {
    var dragInfo = currentDraggingHandle.data('dragInfo');
    var width = $('#gradient').width();
    var newOffset = (dragInfo.startPosition + (event.screenX - dragInfo.startScreenX)) / width;
    newOffset = Math.min(Math.max(newOffset, 0), 1);
    currentDraggingHandle.data('handle').offset = newOffset;
    currentDraggingHandle.css('left', (100 * newOffset) + '%');
    sortColorHandles();
  }
}

function sortColorHandles() {
  colorHandles.sort(function(a,b) {
    return a.offset - b.offset;
  });
  paintColorGradient();
}
