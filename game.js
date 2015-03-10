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

var kestrel_active;
var kestrel_pos;

var player_alive;
var player_start_pos;
var player_pos;
var player_score;
var player_narration;

var camera_pos;
var camera_dt;
var camera_t;

var show_title;

var gen_y;
var gen_state;
var gen_state_end;

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
      if(ROT.RNG.getUniform() > .9) {
        row[x] = "*";
      }
      if(gen_y == 0 || in_gutter(x)) {
        row[x] = "*";
      }
    }
  } else if(gen_state == "water") {
    for(var x = 0; x < field_shape[0]; ++x) {
      row[x] = "~";
      if(!in_gutter(x) && ROT.RNG.getUniform() > .7) {
        row[x] = "o";
      }
    }
    if(ROT.RNG.getUniform() > .3) {
      move_player = true;
      if(ROT.RNG.getUniform() > .5) {
        dt = 60;
      } else {
        dt = 90;
      }
      if(ROT.RNG.getUniform() < .5) {
        dt *= -1;
      }
      for(var x = 0; x < rows_shape[0]; ++x) {
        if(ROT.RNG.getUniform() > .5) {
          row[x] = "-";
        } else {
          row[x] = "~";
        }
      }
    }
  } else if(gen_state == "road") {
    if(ROT.RNG.getUniform() > .5) {
      dt = 120;
    } else {
      dt = 180;
    }
    if(ROT.RNG.getUniform() < .5) {
      dt *= -1;
    }
    var skip = 0;
    for(var x = 0; x < rows_shape[0]; ++x) {
      skip--;
      if(x >= rows_shape[0] - 2 || skip > 0 || ROT.RNG.getUniform() < .8) {
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
    if(ROT.RNG.getUniform() < .5) {
      dt *= -1;
    }
    var len = 20;
    var start = Math.floor(5 + ROT.RNG.getUniform() * 60);
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
    var dart = ROT.RNG.getUniform();
    if(dart < .25) gen_state = "grass";
    else if(dart < .50) gen_state = "railroad";
    else if(dart < .75) gen_state = "water";
    else gen_state = "road";

    gen_state_end = gen_y + 1 + Math.floor(ROT.RNG.getUniform() * 3);
  }
}

function init_game() {
  game_time = 0;

  gen_y = 0;
  gen_state = "grass";
  gen_state_end = 5;
  camera_pos = [0, -1];
  camera_dt = 120;
  camera_t = 0;

  kestrel_active = false;
  kestrel_pos = [0, 0];

  player_alive = true;
  player_start_pos = [Math.floor(field_shape[0] / 2), 3];
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
  rows_shape = [1000, 15];
  var font_size = 50;

  // screen_shape = [75, 75];
  // field_shape = [75, 75];
  // rows_shape = [100, 100];
  // font_size = 10;

  gutter_width = 2;

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
  for(var i = 0; i < rows_shape[0]; ++i) {
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
    return field[y][x] != '*';
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

function field_to_rows(pos) {
  return world_to_rows(field_to_world(pos));
}

function get_bg(pos) {
  var tile = get_tile(pos);
  var bg = [0, 0, 0];
  switch(tile) {
  case ".": {
    if(pos[1] % 2 == 0) {
      bg = [189, 244, 102];
    } else {
      bg = [182, 236, 94];
    }
  } break;
  case "*": {
    if(pos[1] % 2 == 0) {
      bg = [189, 244, 102];
    } else {
      bg = [182, 236, 94];
    }
  } break;
  case "-":
  case "~": {
    bg = [129, 245, 255];
  } break;
  case "o": {
    bg = [129, 245, 255];
  } break;
  case "_":
  case "#":
  case ")":
  case "(":
  case "]":
  case "[": {
    bg = [82, 88, 101];
  } break;
  case "=":
  case "T": {
    bg = [82, 88, 101];
  } break;
  }
  return bg;
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
      row[x] = 1;
    }
  }

  // var fov = new ROT.FOV.PreciseShadowcasting(light_passes);
  // fov.compute(player_pos[0], player_pos[1], 10, function(x, y, r, v) {
  //   if(y >= 0 && y < visibility.length && x >= 0 && x < visibility[0].length) {
  //     visibility[y][x] = v; // * (10 - r) / 10;
  //   }
  // });

  for(var y = 0; y < screen_shape[1]; ++y) {
    for(var x = 0; x < screen_shape[0]; ++x) {
      var pos = field_to_world([x, y]);
      var row_pos = field_to_rows([x, y]);
      var tile = get_tile(pos);
      var display_tile = tile;
      var fg = "#fff";
      var bg = "#000";
      switch(tile) {
      case ".": {
        if(pos[1] % 2 == 0) {
          fg = [189, 244, 102]; bg = [189, 244, 102];
        } else {
          fg = [182, 236, 94]; bg = [182, 236, 94];
        }
      } break;
      case "*": {
        if(pos[1] % 2 == 0) {
          bg = [189, 244, 102];
        } else {
          bg = [182, 236, 94];
        }
        fg = [130, 153, 31];
      } break;
      case "~": {
        bg = [129, 245, 255];
        fg = [129, 245, 255];
      } break;
      case "o": {
        bg = [129, 245, 255];
        fg = [30, 209, 118]; //[17, 181, 94];
      } break;
      case "-": {
        bg = [129, 245, 255];
        fg = [141, 83,  80];
      } break;
      case "_": {
        bg = [82, 88, 101];
        fg = [82, 88, 101];
        // if(pos[0] % 2 == 0) {
        //   display_tile = "_";
        //   fg = [125, 135, 154];
        // }
      } break;
      case "#":
      case ")":
      case "(":
      case "]":
      case "[": {
        bg = [82, 88, 101];
        fg = [147, 97,  255];
      } break;
      case "=": {
        bg = [82, 88, 101];
        fg = [125, 135, 154];
      } break;
      case "T": {
        bg = [82, 88, 101];
        fg = [129, 245, 255];
      } break;
      }
      var v = visibility[y][x] * 255;
      fg = ROT.Color.multiply(fg, [v, v, v]);
      bg = ROT.Color.multiply(bg, [v, v, v]);
      if(tile == "-" || tile == "~") {
        if(x < gutter_width || x >= screen_shape[0] - gutter_width) {
          var w = Math.floor(ROT.RNG.getUniform() * 64);
          bg = ROT.Color.add(bg, [w, w, w]);
          var dt = row_dts[row_pos[1]];
          if(tile == "~") display_tile = (dt < 0)? ")" : "(";
        }
      }
      if(tile == "]" || tile == "[") {
        var dt = Math.abs(row_dts[row_pos[1]]);
        window.console.log(dt, game_time);
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
      var pos = world_to_screen(pos);
      display.draw(pos[0], pos[1], display_tile, ROT.Color.toRGB(fg), ROT.Color.toRGB(bg));
    }
  }

  // for(var i = 0; i < rows.length; ++i) {
  //   var fg = "#fff";
  //   var bg = "#000";
  //   var pos = world_to_screen(rows[i].p);
  //   display.draw(pos[0], pos[1], "X", fg, bg);
  // }

  if(kestrel_active) {
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
    var fg = [255, 255, 255];
    var screen_pos = [0, 0];
    var bg = get_bg(screen_to_world(screen_pos));
    var col = "%c{" + ROT.Color.toRGB(fg) + "}" + "%b{" + ROT.Color.toRGB(bg) + "}";
    if(player_score > 0) {
      display.drawText(
        screen_pos[0], screen_pos[1], col + player_score.toString());
    }
    var x = Math.floor((screen_shape[0] - player_narration.length) / 2);
    display.drawText(x, 0, col + player_narration);
  }

  if(show_title) {
    var mid = [Math.floor(screen_shape[0] / 2), Math.floor(screen_shape[1] / 2)];
    display.drawText(mid[0] - 2, mid[1] - 1, "%c{#fff}COPY");
    display.drawText(mid[0] - 3, mid[1], "%c{#fff}FROGUE");
  }
}

function tick() {
  game_time += 10;

  if(camera_pos[1] < 0) camera_pos[1] = 0;
  if((game_time - camera_t) % camera_dt == 0) {
    if(player_alive && player_pos[1] > camera_pos[1]) {
      // camera_pos[1]++;
    }
  }

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

  if(!kestrel_active && player_pos[1] <= camera_pos[1]) {
    kestrel_active = true;
    kestrel_pos = [player_pos[0], player_pos[1] + screen_shape[1]];
  }

  if(kestrel_active) {
    kestrel_pos[0] = player_pos[0];
    if(kestrel_pos[1] > player_pos[1]) kestrel_pos[1]--;
  }

  if(player_alive) {
    if(player_pos[0] < gutter_width || player_pos[0] >= field_shape[0] - gutter_width) {
      player_alive = false;
    }
    var tile = get_tile(player_pos);
    if(tile == "[" || tile == "]") {
      player_alive = false;
      player_narration = "CAR";
    }
    if(tile == "T") {
      player_alive = false;
      player_narration = "TRAIN";
    }
    if(kestrel_active && kestrel_pos[1] == player_pos[1]) {
      player_alive = false;
      player_narration = "KESTREL";
    }
  }

  if(game_time % 60 == 0) {
    key_handler = window.addEventListener("keyup", key_up);
  } else {
    setTimeout(tick, 5);
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
        if(new_tile == "." || new_tile == "o" || new_tile == "~" || new_tile == "-" || new_tile == "_" || new_tile == "[" || new_tile == "]" || new_tile == "=" || new_tile == "T") {
          player_pos[0] += dp[0];
          player_pos[1] += dp[1];
          player_score = Math.max(player_score, player_pos[1] - player_start_pos[1]);
          if(new_tile == "~") {
            player_alive = false;
            player_narration = "WATER";
          }
          if(new_tile == "[" || new_tile == "]") {
            player_alive = false;
            player_narration = "CAR";
          }
          if(new_tile == "T") {
            player_alive = false;
            player_narration = "TRAIN";
          }
        }
      }
      camera_pos[1] = Math.max(camera_pos[1], player_pos[1] - 3);
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
