function _game() {

var screen_shape;
var field_shape;
var gutter_width;
var display;
var field;
var visibility;
var rows;
var row_dts;
var row_move_player;
var rows_shape;
var key_handler;

var game_time;

var kestrel_homing;
var kestrel_pos;
var kestrel_v;
var kestrel_dt;
var kestrel_t;
var kestrel_dty;
var kestrel_range;
var kestrel_dead_y;

var player_alive;
var player_start_pos;
var player_pos;
var player_score;
var player_narration;

var camera_begin;
var camera_end;
var camera_pos;
var camera_t;

var show_title;

var gen_y;
var gen_state;
var gen_state_end;
var gen_state_first_end;

var car_dts = [60, 120, 180, 240, 300, 360];
var colors = {
  black: [0, 0, 0],
  white: [255, 255, 255],
  blue_background: [105, 206, 236],
  water: [129, 245, 255],
  light_grass: [189, 244, 102],
  dark_grass: [182, 236, 94],
  wood: [141, 83, 80],
  tree: [182, 214, 33],
  tree_front: [130, 153, 31],
  tree_side: [59, 70, 18],
  cars: [
    [254, 59, 69], // red
    [255, 77, 43], // orange
    [255, 234, 93], // yellow
    [143, 215, 93], // green
    [4, 188, 250], // blue
    [147, 97, 255], // violet
  ],
  road: [82, 88, 101],
  road_stripe: [125, 135, 154],
  lily_pad_dark: [17, 181, 94],
  lily_pad_light: [30, 209, 118],
};

function rng_uniform() {
    return ROT.RNG.getUniform();
}

function rng_int(end) {
  var r = Math.floor(rng_uniform() * end);
  if(r == end) r = end - 1;
  return r;
}

function rng_discrete(ps) {
  var total = 0;
  for(var i = 0; i < ps.length; ++i) {
    total += ps[i];
  }
  var dart = rng_uniform() * total;
  var sum = 0;
  for(var i = 0; i < ps.length; ++i) {
    sum += ps[i];
    if(dart < sum) return i;
  }
  return ps.length - 1;
}

function rng_choose(values, ps) {
  return values[rng_discrete(ps)];
}

function in_gutter(x) {
  return x < gutter_width || x >= field_shape[0] - gutter_width;
}

function gen_row() {
  var row = rows[gen_y % rows_shape[1]];
  var dt = 0;
  var move_player = false;
  if(gen_state == "grass") {
    for(var x = 0; x < field_shape[0]; ++x) {
      row[x] = ".";
      if(rng_uniform() < .1) {
        row[x] = "*";
      }
      if(gen_y == 0 || in_gutter(x)) {
        row[x] = "*";
      }
    }
  } else if(gen_state == "water") {
    for(var x = 0; x < field_shape[0]; ++x) {
      row[x] = "~";
      if(!in_gutter(x) && rng_uniform() < .3) {
        row[x] = "o";
      }
    }
    if(rng_uniform() < .7) {
      move_player = true;
      if(rng_uniform() < .5) {
        dt = 60;
      } else {
        dt = 90;
      }
      if(rng_uniform() < .5) {
        dt *= -1;
      }
      for(var x = 0; x < rows_shape[0]; ++x) {
        if(rng_uniform() < .5) {
          row[x] = "-";
        } else {
          row[x] = "~";
        }
      }
    }
  } else if(gen_state == "road") {
    dt = car_dts[rng_int(car_dts.length)];
    if(rng_uniform() < .5) {
      dt *= -1;
    }
    var skip = 0;
    for(var x = 0; x < rows_shape[0]; ++x) {
      skip--;
      if(x >= rows_shape[0] - 2 || skip > 0 || rng_uniform() < .8) {
        row[x] = "_";
      } else {
        if(dt < 0) {
          row[x++] = "[";
          row[x] = ")";
          skip = 2;
        } else {
          row[x++] = "(";
          row[x] = "]";
          skip = 2;
        }
      }
    }
  } else if(gen_state == "railroad") {
    dt = 10;
    if(rng_uniform() < .5) {
      dt *= -1;
    }
    var len = 20;
    var start = Math.floor(5 + rng_uniform() * 60);
    if(dt < 0) {
      start = Math.max(0, rows_shape[0] - start - len);
    }
    for(var x = 0; x < rows_shape[0]; ++x) {
      if(x >= start && x < start + len) {
        row[x] = "T";
      } else {
        row[x] = "=";
      }
    }
  }
  row_dts[gen_y % rows_shape[1]] = dt;
  row_move_player[gen_y % rows_shape[1]] = move_player;
  ++gen_y;
  if(gen_y == gen_state_end) {
    gen_state = rng_choose(
      ["grass", "railroad", "water", "road"],
      [.25, .25, .25, .25]);

    gen_state_end = gen_y + 1 + Math.floor(rng_uniform() * 3);
  }
}

function init_game() {
  game_time = 0;

  gen_y = 0;
  gen_state = "grass";
  gen_state_end = gen_state_first_end;
  camera_pos = [0, 0];
  camera_t = 0;

  kestrel_homing = false;
  kestrel_pos = [Math.floor(screen_shape[1] / 2), 0];
  kestrel_v = (rng_uniform() < .5)? 1 : -1;
  kestrel_dt = 30;
  kestrel_t = 0;
  kestrel_dty = 60 * 4;
  kestrel_range = 2;
  kestrel_dead_y = 3;

  player_alive = true;
  player_pos = player_start_pos.slice();
  player_score = 0;
  player_narration = "";
  show_title = true;
}

function init() {
  window.console.log("bar");

  // document.getElementById("tweeter").click();

  // camera shows ~11 whole rows
  screen_shape = [13, 13];
  field_shape = [13, 13];
  rows_shape = [1000, 27];
  gutter_width = 2;
  player_start_pos = [Math.floor(field_shape[0] / 2), 3];
  gen_state_first_end = 5;

  var font_size = 50;

  // gen overview settings
  // screen_shape = [75, 75];
  // field_shape = [75, 75];
  // rows_shape = [100, 100];
  // font_size = 10;

  // screenshot settings
  // screen_shape = [15, 6];
  // field_shape = [15, 6];
  // rows_shape = [1000, 27];
  // gutter_width = 3;
  // player_start_pos = [Math.floor(field_shape[0] / 2), 1];
  // gen_state_first_end = 2;

  display = new ROT.Display({
    width: screen_shape[0],
    height: screen_shape[1],
    fontSize: font_size
  });
  document.getElementById("display").appendChild(display.getContainer());

  field = new Array(field_shape[1]);
  visibility = new Array(field_shape[1]);
  for(var i = 0; i < field_shape[1]; ++i) {
    field[i] = new Array(field_shape[0]);
    visibility[i] = new Array(field_shape[0]);
  }

  rows = new Array(rows_shape[1]);
  row_dts = new Array(rows_shape[1]);
  row_move_player = new Array(rows_shape[1]);
  for(var i = 0; i < rows_shape[1]; ++i) {
    rows[i] = new Array(rows_shape[0]);
    row_dts[i] = 0;
    row_move_player[i] = false;
  }

  init_game();

  tick();
  key_handler = window.addEventListener("keyup", key_up);
  window.onkeydown = key_down;
}

function key_down(event) {
  var code = event.keyCode;
  if(code == ROT.VK_SPACE) return false;
  // var vk = "?";
  // for(var name in ROT) {
  //   if(ROT[name] == code && name.indexOf("VK_") == 0) {
  //     vk = name;
  //   }
  // }
  // display.drawText(2, 3, vk);
}

function light_passes(x, y) {
  if(y >= 0 && y < visibility.length && x >= 0 && x < visibility[0].length) {
    switch(field[y][x]) {
    case "*":
    case "[":
    case "(":
    case "]":
    case ")":
    case "T":
      return false;
    }
    return true;
  } else {
    return false;
  }
}

function world_to_screen(pos) {
  return [pos[0] - camera_pos[0], screen_shape[1] - 1 - (pos[1] - camera_pos[1])];
}

function screen_to_world(pos) {
  return [pos[0] + camera_pos[0], screen_shape[1] - 1 - (pos[1] - camera_pos[1])];
}

function world_to_rows(pos) {
  return [pos[0] % rows_shape[0], pos[1] % rows_shape[1]];
}

function world_to_field(pos) {
  return [pos[0] - camera_pos[0], pos[1] - camera_pos[1]];
}

function field_to_world(pos) {
  return [pos[0] + camera_pos[0], pos[1] + camera_pos[1]];
}

function field_to_screen(pos) {
  return world_to_screen(field_to_world(pos));
}

function field_to_rows(pos) {
  return world_to_rows(field_to_world(pos));
}

function render_tile(pos) {
  var row_pos = world_to_rows([pos[0], pos[1]]);
  var tile = get_tile(pos);
  var display_tile = tile;
  var fg = "#fff";
  var bg = "#000";
  switch(tile) {
  case ".": {
    if(pos[1] % 2 == 0) {
      fg = colors.light_grass; bg = colors.light_grass;
    } else {
      fg = colors.dark_grass; bg = colors.dark_grass;
    }
  } break;
  case "*": {
    if(pos[1] % 2 == 0) {
      bg = colors.light_grass;
    } else {
      bg = colors.dark_grass;
    }
    fg = colors.tree_front;
  } break;
  case "~": {
    bg = colors.water;
    fg = colors.water;
  } break;
  case "o": {
    bg = colors.water;
    fg = colors.lily_pad_light;
  } break;
  case "-": {
    bg = colors.water;
    fg = colors.wood;
  } break;
  case "_": {
    bg = colors.road;
    fg = colors.road;
    display_tile = " ";
    // if(pos[0] % 2 == 0) {
    //   display_tile = "_";
    //   fg = colors.road_stripe;
    // }
  } break;
  case "#":
  case ")":
  case "(":
  case "]":
  case "[": {
    bg = colors.road;
    var dt = row_dts[row_pos[1]];
    var idx = car_dts.indexOf(Math.abs(dt));
    fg = colors.cars[idx];
  } break;
  case "=": {
    bg = colors.road;
    fg = colors.road_stripe;
  } break;
  case "T": {
    bg = colors.road;
    fg = colors.water;
  } break;
  }
  if(in_gutter(pos[0])) {
    if(tile == "-" || tile == "~") {
      var w = Math.floor(rng_uniform() * 64);
      bg = ROT.Color.add(bg, [w, w, w]);
      var dt = row_dts[row_pos[1]];
      if(tile == "~") display_tile = (dt < 0)? ")" : "(";
    } else {
      bg = ROT.Color.interpolate(bg, colors.black, .05);
    }
  }
  if(tile == "]" || tile == "[") {
    var dt = Math.abs(row_dts[row_pos[1]]);
    var time = game_time - (game_time % 60);
    var time_until_move = dt - 60 - (time % dt);
    var turns_until_move = time_until_move / 60;
    var turns = dt / 60;
    var readiness = 1 - (turns_until_move / turns);
    var c = readiness * 255;
    var c0 = ROT.Color.interpolate(bg, fg, .5);
    var c1 = ROT.Color.interpolate(fg, [c, c, c], .5);
    fg = ROT.Color.interpolate(c0, c1, readiness);
  }

  {
    var fp = world_to_field(pos);
    if(valid_p(fp, field_shape)) {
      var v = visibility[fp[1]][fp[0]] * 255;
      // fg = ROT.Color.multiply(fg, [v, v, v]);
      // bg = ROT.Color.multiply(bg, [v, v, v]);
    }
  }

  return {
    tile: display_tile,
    bg: bg,
    fg: fg
  }
}

function valid_p(p, shape) {
  return p[0] >= 0 && p[0] < shape[0] && p[1] >= 0 && p[1] < shape[1];
}

function get_bg(pos) {
  return render_tile(pos).bg;
}

function get_tile(pos) {
  pos = world_to_field(pos);
  if(pos[0] < 0 || pos[0] >= field_shape[0] || pos[1] < 0 || pos[1] >= field_shape[1]) {
    return ' ';
  } else {
    return field[pos[1]][pos[0]];
  }
}

function draw() {
  for(var y = 0; y < visibility.length; ++y) {
    var row = visibility[y];
    for(var x = 0; x < row.length; ++x) {
      row[x] = 0;
    }
  }

  {
    var pos = world_to_field(player_pos);
    var fov = new ROT.FOV.PreciseShadowcasting(light_passes);
    fov.compute(pos[0], pos[1], 10, function(x, y, r, v) {
      if(y >= 0 && y < visibility.length && x >= 0 && x < visibility[0].length) {
        visibility[y][x] = v; // * (10 - r) / 10;
      }
    });
  }

  for(var y = 0; y < screen_shape[1]; ++y) {
    for(var x = 0; x < screen_shape[0]; ++x) {
      var tile = render_tile(field_to_world([x, y]));
      var pos = field_to_screen([x, y]);
      display.draw(
        pos[0], pos[1], tile.tile,
        ROT.Color.toRGB(tile.fg),
        ROT.Color.toRGB(tile.bg));
    }
  }

  // for(var i = 0; i < rows.length; ++i) {
  //   var fg = "#fff";
  //   var bg = "#000";
  //   var pos = world_to_screen(rows[i].p);
  //   display.draw(pos[0], pos[1], "X", fg, bg);
  // }

  // kestrel
  {
    var fg = ROT.Color.toRGB([141, 83,  80]);
    var tile = "K";
    var bg = ROT.Color.toRGB(get_bg(kestrel_pos));
    var pos = world_to_screen(kestrel_pos);
    display.draw(pos[0], pos[1], tile, fg, bg);
  }

  {
    var fg = "#fff";
    var tile = "@";
    if(!player_alive) {
      fg = "#000";
      tile = "X";
    }
    var bg = ROT.Color.toRGB(get_bg(player_pos));
    var pos = world_to_screen(player_pos);
    display.draw(pos[0], pos[1], tile, fg, bg);
  }

  {
    var fg = colors.white;
    var screen_pos = [0, 0];
    var bg = get_bg(screen_to_world(screen_pos));
    var col = "%c{" + ROT.Color.toRGB(fg) + "}" + "%b{" + ROT.Color.toRGB(bg) + "}";
    if(player_score > 0) {
      display.drawText(
        screen_pos[0], screen_pos[1], col + player_score.toString());
    }
    var x = Math.floor((screen_shape[0] - player_narration.length) / 2);
    var bg = get_bg(screen_to_world([x, 0]));
    var col = "%c{" + ROT.Color.toRGB(fg) + "}" + "%b{" + ROT.Color.toRGB(bg) + "}";
    display.drawText(x, 0, col + player_narration);
  }

  if(show_title) {
    var mid = [Math.floor(screen_shape[0] / 2), Math.floor(screen_shape[1] / 2)];
    display.drawText(mid[0] - 2, mid[1] - 1, "%c{#fff}COPY");
    display.drawText(mid[0] - 3, mid[1], "%c{#fff}FROGUE");
  }
}

function camera_tick() {
  camera_t += .05;

  var camera_y = camera_begin * (1 - camera_t) + camera_end * camera_t;
  var new_pos_y = Math.max(0, Math.floor(camera_y));

  if(camera_pos[1] != new_pos_y) {
    camera_pos[1] = new_pos_y;
    while(gen_y - camera_pos[1] < screen_shape[1]) {
      gen_row();
    }

    for(var y = 0; y < field_shape[1]; ++y) {
      var world_y = field_to_world([0, y])[1];
      var row_y = world_to_rows([0, world_y])[1];
      var dt = Math.abs(row_dts[row_y]);
      var dx = (dt == 0)? 0 : row_dts[row_y] / dt;
      var cycles = (dt == 0)? 0 : Math.floor(game_time / dt);
      var x0 = (dx <= 0)? 0 : rows_shape[0] - 1 - field_shape[0];
      x0 += dx * cycles;
      while(x0 < 0) x0 += rows_shape[0];

      for(var x = 0; x < field_shape[0]; ++x) {
        var row_pos = field_to_rows([x + x0, y]);
        field[y][x] = rows[row_pos[1]][row_pos[0]];
      }
    }
  }

  draw();
  if(camera_t >= 1) {
    camera_pos[1] = camera_end;
    tick();
  } else {
    setTimeout(camera_tick, 5);
  }
}

function tick() {
  {
    var trigger = 3;
    var dy = player_pos[1] - camera_pos[1];
    if(dy >= screen_shape[1] - trigger) {
      camera_t = 0;
      camera_begin = camera_pos[1];
      camera_end = Math.max(0, Math.floor(player_pos[1] - trigger));
      return camera_tick();
    } else if(player_pos[1] >= trigger && dy < trigger) {
      camera_t = 0;
      camera_begin = camera_pos[1];
      camera_end = Math.max(0, Math.floor(player_pos[1] - (screen_shape[1] - 1 - trigger)));
      return camera_tick();
    }
  }

  var tick_dt = 5;
  game_time += tick_dt;

  while(gen_y - camera_pos[1] < screen_shape[1]) {
    gen_row();
  }

  for(var y = 0; y < field_shape[1]; ++y) {
    var world_y = field_to_world([0, y])[1];
    var row_y = world_to_rows([0, world_y])[1];
    var dt = Math.abs(row_dts[row_y]);
    var dx = (dt == 0)? 0 : row_dts[row_y] / dt;
    var cycles = (dt == 0)? 0 : Math.floor(game_time / dt);
    var x0 = (dx <= 0)? 0 : rows_shape[0] - 1 - field_shape[0];
    x0 += dx * cycles;
    while(x0 < 0) x0 += rows_shape[0];

    var move_player = row_move_player[row_y];
    if(move_player) {
      if(player_alive && player_pos[1] == world_y && game_time % dt == 0) {
        player_pos[0] -= dx;
      }
    }

    for(var x = 0; x < field_shape[0]; ++x) {
      var row_pos = field_to_rows([x + x0, y]);
      field[y][x] = rows[row_pos[1]][row_pos[0]];
    }
  }

  if(kestrel_homing) {
    kestrel_pos[1] = player_pos[1];
  } else {
    if(kestrel_pos[1] >= player_pos[1]) {
      kestrel_homing = true;
      kestrel_dt = 15;
      if(player_pos[0] == kestrel_pos[0]) {
        kestrel_v = 0;
      } else {
        kestrel_v = (player_pos[0] < kestrel_pos[0])? -1 : 1;
      }
    } else {
      kestrel_t += tick_dt;
      if(kestrel_t >= kestrel_dty) {
        kestrel_pos[1]++;
        kestrel_t = 0;
      }
    }
  }

  if(game_time % kestrel_dt == 0) {
    kestrel_pos[0] += kestrel_v;
    if((kestrel_pos[0] <= -kestrel_range && kestrel_v < 0) ||
       (kestrel_pos[0] > screen_shape[0] + kestrel_range && kestrel_v > 0)) {
      if(rng_uniform() < .8) kestrel_v *= -1;
      if(player_pos[1] - kestrel_pos[1] > kestrel_dead_y) {
        kestrel_pos[1] = player_pos[1] - kestrel_dead_y;
        kestrel_t = 0;
      }
    }
  }


  if(player_alive) {
    if(in_gutter(player_pos[0])) {
      player_alive = false;
      player_narration = "RAPIDS";
    }
    var tile = get_tile(player_pos);
    if(tile == "[" || tile == "]" || tile == "(" || tile == ")") {
      player_alive = false;
      player_narration = "CAR";
    }
    if(tile == "T") {
      player_alive = false;
      player_narration = "TRAIN";
    }
    if(kestrel_pos[0] == player_pos[0] && kestrel_pos[1] == player_pos[1]) {
      kestrel_v = 0;
      player_alive = false;
      player_narration = "KESTREL";
    }
  }

  if(game_time % 60 == 0) {
    key_handler = window.addEventListener("keyup", key_up);
  } else {
    setTimeout(tick, 2);
  }

  draw();
}

function key_up(event) {
  if(event.keyCode == ROT.VK_P) {
    // var img = document.createElement("img");
    // img.setAttribute('src', display.getContainer().toDataURL("image/png"));
    // document.body.appendChild(img);
    window.open(display.getContainer().toDataURL("image/png"), "_blank");
  }

  var up = (event.keyCode == ROT.VK_W);
  var down = (event.keyCode == ROT.VK_S);
  var left = (event.keyCode == ROT.VK_A);
  var right = (event.keyCode == ROT.VK_D);
  var wait = (event.keyCode == ROT.VK_SPACE);

  if(!(up || down || left || right || wait)) return;
  show_title = false;

  var dp = [0, 0];
  if(up) dp[1]++;
  if(down) dp[1]--;
  if(left) dp[0]--;
  if(right) dp[0]++;

  if(dp[0] != 0 || dp[1] != 0) {
    if(player_alive) {
      var new_pos = [player_pos[0] + dp[0], player_pos[1] + dp[1]];
      var new_tile = get_tile(new_pos);
      if(!in_gutter(new_pos[0]) || row_move_player[world_to_rows(new_pos)[1]]) {
        if(new_tile == "." || new_tile == "o" || new_tile == "~" || new_tile == "-" || new_tile == "_" || new_tile == "[" || new_tile == "]" || new_tile == "(" || new_tile == ")" || new_tile == "=" || new_tile == "T") {
          player_pos[0] += dp[0];
          player_pos[1] += dp[1];
          player_score = Math.max(player_score, player_pos[1] - player_start_pos[1]);
          if(new_tile == "~") {
            player_alive = false;
            player_narration = "WATER";
          }
          if(new_tile == "[" || new_tile == "]" || new_tile == "(" || new_tile == ")") {
            player_alive = false;
            player_narration = "CAR";
          }
          if(new_tile == "T") {
            player_alive = false;
            player_narration = "TRAIN";
          }
        }
      }
    } else {
      init_game();
    }
  }



  window.removeEventListener("keyup", key_up);
  tick();
}

return init;
}

var __game = _game();

window.onload = function() { __game(); }
