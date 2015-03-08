function _game() {

var screen_shape;
var map_shape;
var display;
var map;
var visibility;
var queue;
var things;
var key_handler;
var player_pos;
var camera_pos;

function init() {
  window.console.log("bar");

  // document.getElementById("tweeter").click();

  // camera shows ~11 whole rows
  screen_shape = [13, 13];
  // play area is 9 wide
  map_shape = [13, 100];
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
  for(var i = 0; i < map.length; ++i) {
    map[i] = new Array(map_shape[0]);
    visibility[i] = new Array(map_shape[0]);
  }
  for(var y = 0; y < map.length; ++y) {
    var row = map[y];
    for(var x = 0; x < row.length; ++x) {
      row[x] = ".";
      if(ROT.RNG.getUniform() > .9) {
        row[x] = "#";
      }
    }
  }

  player_pos = [5, 3];

  things = new Array(2);
  things[0] = {p: [3, 2], dt: 60};
  things[1] = {p: [3, 3], dt: 20};
  things[2] = {p: [3, 4], dt: 30};

  for(var i = 0; i < things.length; ++i) {
    queue.add(things[i], things[i].dt)
  }

  // display.draw(5, 5, "@");
  // display.drawText(2, 2, "HELLO WORLD");

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
    return map[y][x] != '#';
  } else {
    return false;
  }
}

function world_to_screen(pos) {
  return [pos[0] - camera_pos[0], screen_shape[1] - 1 - (pos[1] - camera_pos[1])];
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
      var pos = [camera_pos[0] + x, camera_pos[1] + y];
      var tile = map[pos[1]][pos[0]];
      var fg = "#fff";
      var bg = "#000";
      switch(tile) {
      case ".": {
        if(y % 2 == 0) {
          fg = [189, 244, 102]; bg = [189, 244, 102];
        } else {
          fg = [182, 236, 94]; bg = [182, 236, 94];
        }
      } break;
      case "#": fg = [0, 80, 0]; bg = [189, 244, 102]; break;
      }
      var v = visibility[y][x] * 255;
      fg = ROT.Color.multiply(fg, [v, v, v]);
      bg = ROT.Color.multiply(bg, [v, v, v]);
      var pos = world_to_screen(pos);
      display.draw(pos[0], pos[1], tile, ROT.Color.toRGB(fg), ROT.Color.toRGB(bg));
    }
  }

  for(var i = 0; i < things.length; ++i) {
    var fg = "#fff";
    var bg = "#000";
    var pos = world_to_screen(things[i].p);
    display.draw(pos[0], pos[1], "X", fg, bg);
  }

  {
    var fg = "#fff";
    var bg = "#000";
    var pos = world_to_screen(player_pos);
    display.draw(pos[0], pos[1], "@", fg, bg);
  }
}

function tick() {
  var end_turn = false;
  queue.add('end_tick', 10);

  while(true) {
    var thing = queue.get();
    var time = queue.getTime();
    if(thing == 'end_tick') {
      break;
    } else if(thing == 'end_turn') {
      end_turn = true;
    } else {
      thing.p[0] += 1;
      queue.add(thing, thing.dt);
    }
  }

  draw();

  if(end_turn) {
    key_handler = window.addEventListener("keyup", key_up);
  } else {
    setTimeout(tick, 10);
  }
}

function key_up(event) {
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

  player_pos[0] += dp[0];
  player_pos[1] += dp[1];

  camera_pos = [0, Math.max(0, player_pos[1] - 3)];

  var time = queue.getTime();
  queue.add('end_turn', 60);
  window.removeEventListener("keyup", key_up);
  tick();
}

return init;
}

window.onload = function() { _game()(); }
