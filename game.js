function _game() {

var screen_shape;
var field_shape;
var gutter_width;
var display;
var field;
var visibility;
var rows;
var row_types;
var row_dts;
var row_move_player;
var row_reachable;
var rows_shape;
var key_handler;

var game_time;
var tick_dt = 5;

var kestrel_homing;
var kestrel_pos;
var kestrel_v;
var kestrel_dt;
var kestrel_t;
var kestrel_dty;
var kestrel_range;
var kestrel_dead_y;
var kestrel_alive;
var kestrel_tamed;

var player_alive;
var player_start_pos;
var player_pos;
var player_score;
var player_gift_text;
var player_gifts;
var player_gifts_remaining;
var player_driving;
var player_cause_of_death;

var camera_begin;
var camera_end;
var camera_pos;
var camera_t;

var end_t;
var end_active;
var end_y = 44; // car at +6
var gift_dy = 11;

var show_title;

var gen_y;
var gen_type;
var gen_end;
var gen_first_end;
var gen_base_progress = 0;

var render_reachable = false;
var render_visible = false;
var render_skew = 0;

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

var dogue_adjectives = ["SO", "SUCH", "MUCH", "MANY", "VRY"];
var dogue_nouns = ["COPY", "FROG", "YENDOR", "DOGUE", "TURNS", "ASCII"];
var dogue_singletons = ["WOW", "GOTY", "#7DRL", "@"];
var dogue_texts;
var dogue_field;
var dogue_color_field;

function rng_uniform() {
    return ROT.RNG.getUniform();
}

function rng_normal(mean, sd) {
  return ROT.RNG.getNormal(mean, sd);
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

function rng_choose_evenly(values) {
  var ps = [];
  for(var i = 0; i < values.length; ++i) ps.push(1);
  return rng_choose(values, ps);
}

function find_runs(row) {
  var runs = [];
  var begin = -1;
  for(var x = 0; x < row.length; ++x) {
    if(row[x] == 1 && begin == -1) {
      begin = x;
    }
    if(row[x] == 0 && begin != -1) {
      runs.push([begin, x]);
      begin = -1;
    }
  }
  if(begin != -1) {
    runs.push([begin, row.length]);
  }
  return runs;
}

function in_gutter(x) {
  return x < gutter_width || x >= field_shape[0] - gutter_width;
}

function render_runs(row, runs) {
  for(var x = 0; x < field_shape[0]; ++x) {
    row[x] = 0;
  }
  for(var i = 0; i < runs.length; ++i) {
    for(var x = runs[i][0]; x < runs[i][1]; ++x) {
      row[x] = 1;
    }
  }
}

function sign(x) {
  if(x == 0) return 0;
  return x / Math.abs(x);
}

function intersect_reachability(row_y, row_y_1) {
  var runs = find_runs(row_reachable[row_y]);
  var runs_1 = find_runs(row_reachable[row_y_1]);
  for(var i = 0; i < runs.length; ++i) {
    var connected = false;
    var ra = runs[i];
    for(var j = 0; j < runs_1.length; ++j) {
      var rb = runs_1[j];
      var min = Math.max(ra[0], rb[0]);
      var max = Math.min(ra[1], rb[1]);
      connected |= (max > min);
    }
    if(!connected) {
      runs[i] = [0, 0];
    }
  }
  render_runs(row_reachable[row_y], runs);
}

function try_row() {
  var progress = gen_y + gen_base_progress;
  var row_y = gen_y % rows_shape[1];
  var row_y_1 = (gen_y - 1 + rows_shape[1]) % rows_shape[1];
  var row_y_2 = (gen_y - 2 + rows_shape[1]) % rows_shape[1];
  var row = rows[row_y];

  var dt = 0;
  var move_player = false;
  var full_type = {
    type: gen_type,
    subtype: null
  };
  if(gen_type == "grass") {
    for(var x = 0; x < field_shape[0]; ++x) {
      row[x] = ".";
      if(rng_uniform() < .1) {
        row[x] = "*";
      }
      if(gen_y == 0 || in_gutter(x)) {
        row[x] = "*";
      }
    }
  } else if(gen_type == "water") {
    var subtypes = ["log", "pad"];
    var ps = [.7, .3];
    ps[subtypes.indexOf("pad")] += 1 / progress;
    if(row_types[row_y_1].subtype == "pad" && row_types[row_y_2].subtype == "pad") {
      ps[subtypes.indexOf("pad")] = 0;
    }
    full_type.subtype = rng_choose(subtypes, ps);
    if(full_type.subtype == "pad") {
      for(var x = 0; x < field_shape[0]; ++x) {
        row[x] = "~";
      }
      var count = rng_choose(
        [1, 2, 3, 4],
        [1, 3, 2, .5]);
      var placed = 0;
      if(row_types[row_y_1].subtype == "pad") {
        var prev_pads = [];
        for(var x = 0; x < field_shape[0]; ++x) {
          if(rows[row_y_1][x] == "o") prev_pads.push(x);
        }
        placed = rng_choose([1, 2], [1, 1]);
        placed = Math.min(Math.min(placed, prev_pads.length), count);
        for(var i = 0; i < placed; ++i) {
          row[prev_pads[i]] = "o";
        }
      }
      for(var i = placed; i < count; ++i) {
        var x = Math.floor(
          gutter_width + rng_uniform() * (field_shape[0] - 2 * gutter_width));
        row[x] = "o";
      }
    } else {
      move_player = true;
      dt = rng_choose(
        [60, 90],
        [1, 1]);
      var sign_ps = [1, 1];
      var sign_prev = sign(row_dts[row_y_1]);
      if(sign_prev != 0) {
        sign_ps[(sign_prev < 0)? 1 : 0] += 1;
      }
      if(sign_prev == sign(row_dts[row_y_2])) {
        sign_ps[(sign_prev < 0)? 0 : 1] = 0;
      }
      dt *= rng_choose([-1, 1], sign_ps);
      for(var x = 0; x < rows_shape[0]; ++x) {
        if(rng_uniform() < .5) {
          row[x] = "-";
        } else {
          row[x] = "~";
        }
      }
    }
  } else if(gen_type == "road") {
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
  } else if(gen_type == "railroad") {
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
  } else if(gen_type == "gift") {
    var gift_y = gen_y - (gen_end - 4);
    if(gift_y < 2) {
      for(var x = 0; x < field_shape[0]; ++x) {
        row[x] = "+";
      }
    } else if(gift_y == 2) {
      full_type.subtype = "gate";
      var field_center = Math.floor(field_shape[0] / 2);
      for(var x = 0; x < field_shape[0]; ++x) {
        if(x == field_center || x == field_center - 2 || x == field_center + 2) {
          row[x] = "?";
        } else {
          row[x] = "!";
        }
      }
    } else {
      for(var x = 0; x < rows_shape[0]; ++x) {
        row[x] = ".";
        if(in_gutter(x)) row[x] = "*";
      }
    }
  } else if(gen_type == "end") {
    var gift_y = gen_y - (gen_end - 16);
    if(gift_y < 2) {
      for(var x = 0; x < field_shape[0]; ++x) {
        row[x] = "+";
      }
    } else if(gift_y == 2) {
      full_type.subtype = "gate";
      var field_center = Math.floor(field_shape[0] / 2);
      for(var x = 0; x < field_shape[0]; ++x) {
        if(x == field_center || x == field_center - 2 || x == field_center + 2) {
          row[x] = "?";
        } else {
          row[x] = "!";
        }
      }
    } else if(gift_y == 9) {
      for(var x = 0; x < rows_shape[0]; ++x) {
        row[x] = "_";
      }
      var cx = Math.floor(field_shape[0] / 2);
      row[cx - 1] = "[";
      row[cx + 1] = "E";
      row[cx + 2] = ")";
    } else {
      for(var x = 0; x < rows_shape[0]; ++x) {
        row[x] = ".";
        if(in_gutter(x)) row[x] = "*";
        if(x > field_shape[0]) {
          row[x] = rng_choose([".", "*"], [1, 1]);
        }
        if(gift_y > 9) {
          row[x] = "~";
          full_type.subtype = "ocean";
        }
      }
      if(gift_y == 8) {
        var cx = Math.floor(field_shape[0] / 2);
        row[cx + 1] = "/";
      }
    }
  }

  row_dts[row_y] = dt;
  row_types[row_y] = full_type;
  row_move_player[row_y] = move_player;
}

function check_reachability() {
  var row_y = gen_y % rows_shape[1];
  var row_y_1 = (gen_y - 1 + rows_shape[1]) % rows_shape[1];
  var row_y_2 = (gen_y - 2 + rows_shape[1]) % rows_shape[1];
  var row = rows[row_y];

  if(gen_y == 0) {
    for(var x = 0; x < field_shape[0]; ++x) {
      row_reachable[row_y][x] = 1;
    }
  } else {
    if(gen_type == "grass") {
      for(var x = 0; x < field_shape[0]; ++x) {
        row_reachable[row_y][x] = (rows[row_y][x] == "*")? 0 : 1;
      }
      intersect_reachability(row_y, row_y_1);
    }
    if(gen_type == "road") {
      var dir = sign(row_dts[row_y]);
      var runs = [];
      var runs_1 = find_runs(row_reachable[row_y_1]);
      if(runs_1.length > 0) {
        if(dir > 0) {
          runs.push([gutter_width, runs_1[runs_1.length - 1][1]]);
        } else {
          runs.push([runs_1[0][0], field_shape[0] - gutter_width]);
        }
      }
      render_runs(row_reachable[row_y], runs);
    }
    if(gen_type == "railroad") {
      var runs_1 = find_runs(row_reachable[row_y_1]);
      var unreachable = (runs_1.length == 0);
      for(var x = 0; x < field_shape[0]; ++x) {
        row_reachable[row_y][x] = (in_gutter(x) || unreachable)? 0 : 1;
      }
    }
    if(gen_type == "water") {
      if(row_types[row_y].subtype == "pad") {
        for(var x = 0; x < field_shape[0]; ++x) {
          row_reachable[row_y][x] = (rows[row_y][x] == "o")? 1 : 0;
        }
        intersect_reachability(row_y, row_y_1);
      } else {
        var dir = sign(row_dts[row_y]);
        var offs = (Math.abs(row_dts[row_y]) < 120)? -dir : 0;
        var runs = [];
        var runs_1 = find_runs(row_reachable[row_y_1]);
        if(runs_1.length > 0) {
          var r;
          if(dir > 0) { // to the left
            r = [gutter_width, runs_1[runs_1.length - 1][1] + offs];
          } else { // to the right
            r = [runs_1[0][0] + offs, field_shape[0] - gutter_width];
          }
          runs.push(r);
        }
        render_runs(row_reachable[row_y], runs);
      }
    }
    if(gen_type == "gift" || gen_type == "end") {
      for(var x = 0; x < field_shape[0]; ++x) {
        row_reachable[row_y][x] = in_gutter(x)? 0 : 1;
      }
    }
  }
  return find_runs(row_reachable[row_y]).length > 0;
}

function gen_row() {
  var progress = gen_y + gen_base_progress;
  var row_y = gen_y % rows_shape[1];
  var row_y_1 = (gen_y - 1 + rows_shape[1]) % rows_shape[1];
  var row_y_2 = (gen_y - 2 + rows_shape[1]) % rows_shape[1];
  var row = rows[row_y];

  if(gen_type != "end" && progress > 0 && progress % gift_dy == 0) {
    gen_type = "gift";
    gen_end = gen_y + 4;
  }

  if(progress == end_y) {
    gen_type = "end";
    gen_end = gen_y + 16;
  }

  var valid = false;
  for(var i = 0; i < 5; ++i) {
    try_row();
    if(check_reachability()) {
      valid = true;
      break;
    }
  }
  if(!valid) {
    gen_type = "grass";
    for(var i = 0; i < 5; ++i) {
      try_row();
      if(check_reachability()) {
        valid = true;
        break;
      }
    }
    if(!valid) {
      gen_type = "railroad";
      try_row();
    }
  }

  ++gen_y;
  ++progress;
  if(gen_y == gen_end) {
    var states = ["grass", "railroad", "water", "road"];
    var ps = [1, 1, .7, 1];

    ps[states.indexOf("grass")] += Math.max(0, 1 - progress / 100);
    ps[states.indexOf(gen_type)] = 0;
    gen_type = rng_choose(states, ps);

    var len = 0;
    if(gen_type == "grass") {
      len = rng_choose(
        [0, 1, 2],
        [10, 5, 2]);
    } else {
      if(gen_type == "railroad") {
        mean = progress / 40;
        sd = progress / 160;
      } else {
        mean = progress / 20;
        sd = progress / 80;
      }

      len = Math.max(0, Math.floor(rng_normal(mean, sd)));
      // len = Math.floor(rng_uniform() * (progress / 25));
    }

    gen_end = gen_y + 1 + len;
  }
}

function init_game() {
  game_time = 0;

  gen_y = 0;
  gen_type = "grass";
  gen_end = gen_first_end;
  camera_pos = [0, 0];
  camera_t = 0;

  kestrel_alive = true;
  kestrel_tamed = false;
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
  player_gift_text = "";
  player_cause_of_death = "";
  player_gifts = {
    blind: false,
    poison: false,
    dogue: false,
    confused: false,
    glove: false,
    // crosswalk: false,
  };
  player_gifts_remaining = Object.keys(player_gifts);
  player_driving = false;

  dogue_texts = [];

  show_title = true;
}

function init() {
  // document.getElementById("tweeter").click();

  // camera shows ~11 whole rows
  screen_shape = [13, 13];
  field_shape = [13, 13];
  rows_shape = [1000, 27];
  gutter_width = 2;
  player_start_pos = [Math.floor(field_shape[0] / 2), 3];
  gen_first_end = 5;

  var font_size = 50;

  // tuning settings
  // screen_shape = [13, 200];
  // field_shape = [13, 200];
  // rows_shape = [50, 500];
  // font_size = 5;

  // screenshot settings
  // screen_shape = [15, 6];
  // field_shape = [15, 6];
  // rows_shape = [1000, 27];
  // gutter_width = 3;
  // player_start_pos = [Math.floor(field_shape[0] / 2), 1];
  // gen_first_end = 2;

  display = new ROT.Display({
    width: screen_shape[0],
    height: screen_shape[1],
    fontSize: font_size
  });
  document.getElementById("display").appendChild(display.getContainer());

  field = new Array(field_shape[1]);
  dogue_field = new Array(field_shape[1]);
  dogue_color_field = new Array(field_shape[1]);
  visibility = new Array(field_shape[1]);
  for(var i = 0; i < field_shape[1]; ++i) {
    field[i] = new Array(field_shape[0]);
    dogue_field[i] = new Array(field_shape[0]);
    dogue_color_field[i] = new Array(field_shape[0]);
    visibility[i] = new Array(field_shape[0]);
  }

  rows = new Array(rows_shape[1]);
  row_reachable = new Array(rows_shape[1]);
  row_dts = new Array(rows_shape[1]);
  row_types = new Array(rows_shape[1]);
  row_move_player = new Array(rows_shape[1]);
  for(var i = 0; i < rows_shape[1]; ++i) {
    rows[i] = new Array(rows_shape[0]);
    row_reachable[i] = new Array(field_shape[0]);
    row_types[i] = "";
    row_dts[i] = 0;
    row_move_player[i] = false;
  }

  init_game();

  tick();
  key_handler = window.addEventListener("keydown", input);
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
  var p = [pos[0], pos[1]];
  if(render_skew > 0) {
      p[1] -= Math.floor(p[0] / render_skew);
  }
  var s = [p[0] - camera_pos[0], screen_shape[1] - 1 - (p[1] - camera_pos[1])];
  if(render_skew > 0) {
    s[1] -= 5;
  }
  return s;
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

function get_gate_progress(pos) {
  var progress = pos[1] + gen_base_progress;
  var idx = Math.floor(pos[1] / gift_dy);
  var pct = (progress - idx * gift_dy) / gift_dy;
  return pct;
}

function get_gate_colors(pos) {
  var progress = pos[1] + gen_base_progress;
  var alpha = (Math.floor(pos[1] / gift_dy) - 1) / 4;
  return {
    dark: ROT.Color.interpolate(colors.road, colors.black, alpha),
    light: ROT.Color.interpolate(colors.road_stripe, colors.white, alpha),
  };
}

function render_tile(pos) {
  var row_pos = world_to_rows(pos);
  var field_pos = world_to_field(pos);
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
    var idx = (dt == 0)? 0 : car_dts.indexOf(Math.abs(dt));
    fg = colors.cars[idx];
  } break;
  case "/": {
    if(pos[1] % 2 == 0) {
      bg = colors.light_grass;
    } else {
      bg = colors.dark_grass;
    }
    fg = colors.cars[0];
  } break;
  case "E": {
    bg = colors.road;
    fg = colors.road;
  } break;
  case "=": {
    bg = colors.road;
    fg = colors.road_stripe;
  } break;
  case "T": {
    bg = colors.road;
    fg = colors.water;
  } break;
  case "+": {
    var gc = get_gate_colors(pos);
    bg = ((Math.floor(pos[0] / 2) + pos[1]) % 2 == 0)? gc.dark : gc.light;
    if(row_types[row_pos[1]].subtype == "gate") bg = gc.dark;
  } break;
  case "!": {
    var gc = get_gate_colors(pos);
    bg = gc.dark;
    fg = gc.light;
    if(pos[0] < 4) {
      display_tile = "GIFT"[pos[0]];
    } else if(pos[0] >= field_shape[0] - 4) {
      display_tile = "GATE"[pos[0] - (field_shape[0] - 4)];
    }

  } break;
  case "?": {
    var gc = get_gate_colors(pos);
    bg = gc.dark;
    fg = rng_choose(colors.cars, [1, 1, 1, 1, 1, 1]);
  }
  }

  if(in_gutter(field_pos[0]) || row_types[row_pos[1]].subtype == "ocean") {
    if(tile == "-" || tile == "~") {
      var w = Math.floor(rng_uniform() * 64);
      bg = ROT.Color.add(bg, [w, w, w]);
      var dt = row_dts[row_pos[1]];
      if(tile == "~" && dt != 0) display_tile = (dt < 0)? ")" : "(";
    } else {
      bg = ROT.Color.interpolate(bg, colors.black, .05);
      fg = ROT.Color.interpolate(fg, colors.black, .05);
    }
  }
  if(tile == "]" || tile == "[") {
    var dt = Math.abs(row_dts[row_pos[1]]);
    if(dt != 0) {
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
  }

  if(player_gifts.dogue) {
    if(valid_p(field_pos, field_shape)) {
      var text = dogue_field[field_pos[1]][field_pos[0]];
      if(text) {
        display_tile = text;
        fg = dogue_color_field[field_pos[1]][field_pos[0]];
      }
    }
  }

  if(render_visible || player_gifts.blind) {
    var fp = world_to_field(pos);
    if(valid_p(fp, field_shape)) {
      var v = visibility[fp[1]][fp[0]] * 255;
      fg = ROT.Color.multiply(fg, [v, v, v]);
      bg = ROT.Color.multiply(bg, [v, v, v]);
    }
  }

  if(render_reachable) {
    if(!row_reachable[row_pos[1]][row_pos[0]]) {
      fg = ROT.Color.interpolate(fg, colors.black, .5);
      bg = ROT.Color.interpolate(bg, colors.black, .5);
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
    fov.compute(pos[0], pos[1], 13, function(x, y, r, v) {
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

  // kestrel
  var fg = [141, 83,  80];
  if(!kestrel_alive) fg = colors.black;
  if(render_visible || player_gifts.blind) {
    var fp = world_to_field(kestrel_pos);
    if(valid_p(fp, field_shape)) {
      var v = visibility[fp[1]][fp[0]] * 255;
      fg = ROT.Color.multiply(fg, [v, v, v]);
    }
  }
  var tile = "K";
  var bg = get_bg(kestrel_pos);
  var pos = world_to_screen(kestrel_pos);
  display.draw(pos[0], pos[1], tile, ROT.Color.toRGB(fg), ROT.Color.toRGB(bg));

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

  if(player_driving) {
    var fg = colors.cars[0];
    var bg = colors.road;
    var pos = world_to_screen(player_pos);
    pos[0] -= 2;
    display.draw(pos[0], pos[1], "[", ROT.Color.toRGB(fg), ROT.Color.toRGB(bg));
    pos[0] += 3;
    display.draw(pos[0], pos[1], ")", ROT.Color.toRGB(fg), ROT.Color.toRGB(bg));
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
    var x = Math.floor((screen_shape[0] - player_gift_text.length) / 2);
    var bg = get_bg(screen_to_world([x, screen_shape[1] - 1]));
    if(player_gift_text == "COPY FROGUE") bg = colors.black;
    var col = "%c{" + ROT.Color.toRGB(fg) + "}" + "%b{" + ROT.Color.toRGB(bg) + "}";
    display.drawText(x, screen_shape[1] - 1, col + player_gift_text);
  }

  if(show_title) {
    var mid = [Math.floor(screen_shape[0] / 2), Math.floor(screen_shape[1] / 2)];
    display.drawText(mid[0] - 2, mid[1] - 1, "%c{#fff}COPY");
    display.drawText(mid[0] - 3, mid[1], "%c{#fff}FROGUE");
  }

  if(!player_alive) {
    var y = Math.floor(screen_shape[1] / 2) - 2;

    var msg = player_cause_of_death;
    var x = Math.floor((screen_shape[0] - msg.length) / 2);
    display.drawText(x, y++, "%c{#fff}" + msg);

    y++;

    var msg = "T:TWEET";
    var x = Math.floor((screen_shape[0] - msg.length) / 2);
    display.drawText(x, y++, "%c{#fff}" + msg);

    var msg = "SPC:RESTART";
    var x = Math.floor((screen_shape[0] - msg.length) / 2);
    display.drawText(x, y++, "%c{#fff}" + msg);
  }
}

function end_tick() {
  for(var i = 0; i < 10; ++i) {
    game_time += tick_dt;
    end_t += .005;
    if(end_t > .5) {
      if(kestrel_tamed) {
        if(kestrel_pos[0] < player_pos[0] - 1) {
          if(game_time % kestrel_dt == 0) kestrel_pos[0]++;
        }
      }
    }
    if(end_t > 1) {
      var row_pos = world_to_rows(player_pos);
      for(var x = 0; x < field_shape[0]; ++x) {
        rows[row_pos[1]][x] = "_";
      }
      player_gift_text = "COPY FROGUE";
      player_driving = true;
      if(game_time % 60 == 0) {
        player_pos[0]++;
        camera_pos[0]++;
        if(kestrel_tamed) {
          kestrel_pos[0] = player_pos[0] - 1;
        } else {
          if(kestrel_alive) {
            kestrel_pos[0]++;
            if(kestrel_pos[0] < player_pos[0] - 5) {
              kestrel_pos[0]++;
            }
            if(game_time % 480 == 0) {
              kestrel_pos[1] += rng_choose([-1, 1], [1, 1]);
              kestrel_pos[1] = Math.min(kestrel_pos[1], player_pos[1] + 3);
              kestrel_pos[1] = Math.max(kestrel_pos[1], player_pos[1] - 3);
            }
          }
        }
      }
    }
  }
  render();
  draw();
  setTimeout(end_tick, 50);
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


function render_dogue() {
  for(var y = 0; y < field_shape[1]; ++y) {
    for(var x = 0; x < field_shape[0]; ++x) {
      dogue_field[y][x] = null;
    }
  }
  for(var i = 0; i < dogue_texts.length; ++i) {
    var text = dogue_texts[i];
    var y = text.pos[1];
    for(var j = 0; j < text.text.length; ++j) {
      var x = text.pos[0] + j;
      dogue_field[y][x] = text.text[j];
      dogue_color_field[y][x] = text.color;
    }
  }
}


function render() {
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

function move_player() {
  var world_y = player_pos[1];
  var row_y = world_to_rows(player_pos)[1];
  var move_player = row_move_player[row_y];
  var dt = Math.abs(row_dts[row_y]);
  var dx = (dt == 0)? 0 : row_dts[row_y] / dt;
  if(move_player) {
    if(player_alive && game_time % dt == 0) {
      player_pos[0] -= dx;
    }
  }
}

function tick() {
  if(end_active) {
    var ey = end_y - gen_base_progress;
    if(player_pos[1] >= ey + 5 && camera_pos[1] != ey + 3) {
      camera_t = 0;
      camera_begin = camera_pos[1];
      camera_end = ey + 3;
      return camera_tick();
    }
  } else {
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

  game_time += tick_dt;

  while(gen_y - camera_pos[1] < screen_shape[1]) {
    gen_row();
  }

  if(get_gate_progress(player_pos) > .75) {
    var keys = Object.keys(player_gifts);
    for(var i = 0; i < keys.length; ++i) {
      player_gifts[keys[i]] = false;
    }
    player_gift_text = "";
  }

  move_player();

  if(kestrel_alive) {
    if(kestrel_tamed) {
      if(game_time % (kestrel_dt * 2) == 0) {
        kestrel_pos[1] += 1;
      }
    } else {
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
    }
  }

  if(player_alive) {
    var row_pos = world_to_rows(player_pos);
    if(in_gutter(player_pos[0])) {
      player_alive = false;
      player_cause_of_death = "SWEPT AWAY";
    }
    var tile = get_tile(player_pos);
    if(tile == "[" || tile == "]" || tile == "(" || tile == ")") {
      player_alive = false;
      player_cause_of_death = "RUN OVER";
    }
    if(tile == "T") {
      player_alive = false;
      player_cause_of_death = "RAILROADED";
    }
    if(tile == "E") {
      var row_pos = world_to_rows(player_pos);
      for(var x = gutter_width; x < field_shape[0] - gutter_width; ++x) {
        rows[row_pos[1] - 1][x] = ".";
      }
      player_gift_text = "";
      // kestrel_tamed = true;
      if(kestrel_alive) {
        kestrel_pos = player_pos.slice();
        kestrel_pos[0] -= 10;
      }
      end_t = 0;
      return end_tick();
    }
    if(tile == "?") {
      for(var x = 0; x < field_shape[0]; ++x) {
        if(rows[row_pos[1]][x] == "?") {
          rows[row_pos[1]][x] = "+";
        }
      }

      if(row_types[row_pos[1]].type == "end") {
        player_gift_text = "KEY";
        end_active = true;
      } else {
        var probs = [];
        for(var i = 0; i < player_gifts_remaining.length; ++i) {
          probs[i] = 1;
        }
        var index = rng_discrete(probs);
        var gift = player_gifts_remaining[index];
        player_gifts_remaining.splice(index, 1);

        switch(gift) {
        case "confused": {
          player_gifts.confused = true;
          player_gift_text = "CONFUSED";
        } break;
        case "dogue": {
          player_gifts.dogue = true;
          player_gift_text = "DOGUE";
          render_dogue();
        } break;
        case "blind": {
          player_gifts.blind = true;
          player_gift_text = "BLIND";
        } break;
        case "glove": {
          player_gifts.glove = true;
          player_gift_text = "KESTREL GLOVE";
        } break;
        case "poison": {
          player_gifts.poison = true;
          player_gift_text = "KESTREL POISN";
        } break;
        }
      }
    }
    if(kestrel_pos[0] == player_pos[0] && kestrel_pos[1] == player_pos[1]) {
      if(player_gifts.poison) {
        kestrel_alive = false;
        player_gift_text = "KILLD KESTREL";
        var idx = player_gifts_remaining.indexOf("glove");
        if(idx != -1) player_gifts_remaining.splice(idx, 1);
      } else if(player_gifts.glove) {
        kestrel_tamed = true;
        player_gift_text = "TAMED KESTREL";
        var idx = player_gifts_remaining.indexOf("poison");
        if(idx != -1) player_gifts_remaining.splice(idx, 1);
      } else if(kestrel_alive && !kestrel_tamed) {
        player_alive = false;
        player_cause_of_death = "KESTRELED";
      }
    }
  }

  if(game_time % 60 == 0) {
    key_handler = window.addEventListener("keydown", input);
  } else {
    setTimeout(tick, 2);
  }

  if(player_gifts.dogue) {
    if(game_time % 60 == 0) {
      if(dogue_texts.length > 5) {
        dogue_texts.splice(Math.floor(rng_uniform() * dogue_texts.length));
      }
      var text = {};
      if(rng_uniform() < .3) {
        text.text = rng_choose_evenly(dogue_singletons);
      } else {
        text.text = rng_choose_evenly(dogue_adjectives)
          + " " + rng_choose_evenly(dogue_nouns);
      }
      text.color = ROT.Color.hsl2rgb([rng_uniform(), 1, .5]);
      text.pos = [
        Math.floor(rng_uniform() * (field_shape[0] - text.text.length)),
        Math.floor(rng_uniform() * field_shape[1]),
      ];
      dogue_texts.push(text);
      render_dogue();
    }
  }
  render();
  draw();
}

function input(event) {
  if(event.keyCode == ROT.VK_P) {
    // var img = document.createElement("img");
    // img.setAttribute('src', display.getContainer().toDataURL("image/png"));
    // document.body.appendChild(img);
    window.open(display.getContainer().toDataURL("image/png"), "_blank");
  }
  if(event.keyCode == ROT.VK_X) {
    init_game();
    window.removeEventListener("keydown", input);
    tick();
    return;
  }
  if(!player_alive) {
    if(event.keyCode == ROT.VK_T) {
      var row = field[world_to_field(player_pos)[1]];
      row[player_pos[0]] = "X";
      var text = row.join("") + "\n" + player_cause_of_death + " AT " + player_score.toString();
      window.open(
        "https://twitter.com/intent/tweet?text=" + encodeURI(text)
          + "&hashtags=copyfrogue"
          + "&url=" + encodeURI("http://cpets.ch/cf/")
      );
    }
    if(event.keyCode == ROT.VK_SPACE) {
      init_game();
      window.removeEventListener("keydown", input);
      tick();
    }
    return;
  }

  var up = (event.keyCode == ROT.VK_W || event.keyCode == ROT.VK_K || event.keyCode == ROT.VK_UP);
  var down = (event.keyCode == ROT.VK_S || event.keyCode == ROT.VK_J || event.keyCode == ROT.VK_DOWN);
  var left = (event.keyCode == ROT.VK_A || event.keyCode == ROT.VK_H || event.keyCode == ROT.VK_LEFT);
  var right = (event.keyCode == ROT.VK_D || event.keyCode == ROT.VK_L || event.keyCode == ROT.VK_RIGHT);
  var wait = (event.keyCode == ROT.VK_SPACE);

  if(!(up || down || left || right || wait)) return;
  show_title = false;

  var dp = [0, 0];
  if(up) dp[1]++;
  if(down) dp[1]--;
  if(left) dp[0]--;
  if(right) dp[0]++;

  if(player_gifts.confused) {
    dp[0] *= -1;
    dp[1] *= -1;
  }

  if(dp[0] != 0 || dp[1] != 0) {
    if(player_alive) {
      var new_pos = [player_pos[0] + dp[0], player_pos[1] + dp[1]];
      var new_tile = get_tile(new_pos);
      if(!in_gutter(new_pos[0]) || row_move_player[world_to_rows(new_pos)[1]]) {
        var row_pos = world_to_rows(player_pos);
        var passable = false;
        switch(new_tile) {
          case ".":
          case "o":
          case "~":
          case "-":
          case "_":
          case "=":
          case "T":
          case "+":
          case "?":
          case "E": passable = true; break;
          case "[":
          case "]":
          case "(":
          case ")": passable = (row_types[row_pos[1]].type != "end"); break;
        }
        if(passable) {
          player_pos[0] += dp[0];
          player_pos[1] += dp[1];
          player_score = Math.max(player_score, player_pos[1] - player_start_pos[1]);
          if(new_tile == "~") {
            player_alive = false;
            player_cause_of_death = "DROWNED";
          }
          if(new_tile == "[" || new_tile == "]" || new_tile == "(" || new_tile == ")") {
            player_alive = false;
            player_cause_of_death = "RUN OVER";
          }
          if(new_tile == "T") {
            player_alive = false;
            player_cause_of_death = "RAILROADED";
          }
        }
      }
    }
  }

  window.removeEventListener("keydown", input);
  tick();
}

return init;
}

var __game = _game();

window.onload = function() {
  var copies = 1;
  // copies = 25;
  for(var i = 0; i < copies; i++) {
    __game();
  }
}
