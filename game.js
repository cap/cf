function _game() {

var screen_shape;
var map_shape;
var gutter_width;
var display;
var map;
var visibility;
var queue;
var rows;
var row_dts;
var rows_shape;
var key_handler;

var game_time;

var player_alive;
var player_start_pos;
var player_pos;
var player_score;
var player_narration;

var camera_pos;
var show_title;

var gen_y;
var gen_state;
var gen_state_end;

function in_gutter(x) {
  return x < gutter_width || x >= map_shape[0] - gutter_width;
}

function gen_row() {
  var row = rows[gen_y];
  var dt = 0;
  if(gen_state == "grass") {
    for(var x = 0; x < map_shape[0]; ++x) {
      row[x] = ".";
      if(gen_y == 0 || ROT.RNG.getUniform() > .9) {
        row[x] = "*";
      }
      if(x < gutter_width || x >= map_shape[0] - gutter_width) {
        row[x] = "*";
      }
    }
  } else if(gen_state == "water") {
    for(var x = 0; x < map_shape[0]; ++x) {
      row[x] = "~";
      if(!in_gutter(x) && ROT.RNG.getUniform() > .7) {
        row[x] = "o";
      }
    }
    if(ROT.RNG.getUniform() > .3) {
      for(var x = 0; x < rows_shape[0]; ++x) {
        if(ROT.RNG.getUniform() > .5) {
          row[x] = "-";
        } else {
          row[x] = "~";
        }
        if(ROT.RNG.getUniform() > .5) {
          dt = 60;
        } else {
          dt = 90;
        }
        if(ROT.RNG.getUniform() < .5) {
          dt *= -1;
        }
      }
    }
  }
  row_dts[gen_y] = dt;
  ++gen_y;
  if(gen_y == gen_state_end) {
    var dart = ROT.RNG.getUniform();
    if(dart < .5) gen_state = "grass";
    else gen_state = "water";

    gen_state_end = gen_y + 1 + Math.floor(ROT.RNG.getUniform() * 7);
  }
}

function init_game() {
  queue.clear();

  game_time = 0;

  gen_y = 0;
  gen_state = "grass";
  gen_state_end = 7;

  player_alive = true;
  player_start_pos = [Math.floor(map_shape[0] / 2), 3];
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
  map_shape = [13, 13];
  rows_shape = [1000, 100];
  gutter_width = 2;
  camera_pos = [0, 0];


  queue = new ROT.EventQueue();
  display = new ROT.Display({
    width: screen_shape[0],
    height: screen_shape[1],
    fontSize: 50
  });
  document.getElementById("display").appendChild(display.getContainer());

  map = new Array(map_shape[1]);
  visibility = new Array(map_shape[1]);
  for(var i = 0; i < map_shape[1]; ++i) {
    map[i] = new Array(map_shape[0]);
    visibility[i] = new Array(map_shape[0]);
  }

  rows = new Array(rows_shape[1]);
  row_dts = new Array(rows_shape[1]);
  for(var i = 0; i < rows_shape[0]; ++i) {
    rows[i] = new Array(rows_shape[0]);
    row_dts[i] = 0;
  }

  init_game();

  tick();
  key_handler = window.addEventListener("keyup", key_up);
}

function key_down(event) {
  var code = event.keyCode;
  var vk = "?";
  for(var name in ROT) {
    if(ROT[name] == code && name.indexOf("VK_") == 0) {
      vk = name;
    }
  }
  display.drawText(2, 3, vk);
}

function light_passes(x, y) {
  if(y >= 0 && y < visibility.length && x >= 0 && x < visibility[0].length) {
    return map[y][x] != '*';
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
  }
  return bg;
}

function get_tile(pos) {
  pos = world_to_field(pos);
  return map[pos[1]][pos[0]];
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
      var tile = get_tile(pos);
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
        fg = [182, 214, 33];
      } break;
      case "~": {
        bg = [129, 245, 255];
        fg = [129, 245, 255];
      } break;
      case "o": {
        bg = [129, 245, 255];
        fg = [182, 214, 33];
      } break;
      case "-": {
        bg = [129, 245, 255];
        fg = [141, 83,  80];
      } break;
      }
      var v = visibility[y][x] * 255;
      fg = ROT.Color.multiply(fg, [v, v, v]);
      bg = ROT.Color.multiply(bg, [v, v, v]);
      if(tile == "-" || tile == "~") {
        if(x < gutter_width || x >= screen_shape[0] - gutter_width) {
          var w = Math.floor(ROT.RNG.getUniform() * 64);
          bg = ROT.Color.add(bg, [w, w, w]);
        }
      }
      var pos = world_to_screen(pos);
      display.draw(pos[0], pos[1], tile, ROT.Color.toRGB(fg), ROT.Color.toRGB(bg));
    }
  }

  // for(var i = 0; i < rows.length; ++i) {
  //   var fg = "#fff";
  //   var bg = "#000";
  //   var pos = world_to_screen(rows[i].p);
  //   display.draw(pos[0], pos[1], "X", fg, bg);
  // }

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
  while(gen_y - camera_pos[1] < screen_shape[1]) {
    gen_row();
  }

  for(var y = 0; y < map_shape[1]; ++y) {
    // if(player_alive && player_pos[1] == y && game_time % row_dts[y] == 0) {
    //   player_pos[0] -= row_dts[y] / Math.abs(row_dts[y]);
    // }
    var dx = 0;
    // if(row_dts[y] != 0) {
    //   dx = Math.floor(game_time / row_dts[y]);
    //   while(dx < 0) dx += rows_shape[0];
    // }
    for(var x = 0; x < map_shape[0]; ++x) {
      var row_pos = field_to_rows([x + dx, y]);
      map[y][x] = rows[row_pos[1]][row_pos[0]];
    }
  }

  if(player_alive) {
    if(player_pos[0] < gutter_width || player_pos[0] >= map_shape[0] - gutter_width) {
      player_alive = false;
    }
  }

  draw();

  game_time += 10;
  if(game_time % 60 == 0) {
    key_handler = window.addEventListener("keyup", key_up);
  } else {
    setTimeout(tick, 5);
  }
}

function key_up(event) {
  if(event.keyCode == ROT.VK_P) {
    // var img = document.createElement("img");
    // img.setAttribute('src', display.getContainer().toDataURL("image/png"));
    // document.body.appendChild(img);
    window.open(display.getContainer().toDataURL("image/png"), "_blank");
  }

  var dp = [0, 0];
  if(event.keyCode == ROT.VK_W) {
    dp[1]++;
  }
  if(event.keyCode == ROT.VK_S) {
    dp[1]--;
  }
  if(event.keyCode == ROT.VK_A) {
    dp[0]--;
  }
  if(event.keyCode == ROT.VK_D) {
    dp[0]++;
  }
  if(dp[0] != 0 || dp[1] != 0) {
    show_title = false;

    if(player_alive) {
      var new_pos = [player_pos[0] + dp[0], player_pos[1] + dp[1]];
      var new_tile = get_tile(new_pos);
      if(new_tile == "." || new_tile == "o" || new_tile == "~" || new_tile == "-") {
        player_pos[0] += dp[0];
        player_pos[1] += dp[1];
        player_score = Math.max(player_score, player_pos[1] - player_start_pos[1]);
        if(new_tile == "~") {
          player_alive = false;
        }
      }
    } else {
      init_game();
    }
  }

  camera_pos = [0, Math.max(0, player_pos[1] - 3)];

  var time = queue.getTime();
  queue.add('end_turn', 60);
  window.removeEventListener("keyup", key_up);
  tick();
}

return init;
}

var __game = _game();

window.onload = function() { __game(); }
