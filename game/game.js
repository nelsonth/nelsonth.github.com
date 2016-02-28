var Upgrade = {
	fromStats: function(dmg_lvl, hp_lvl, base_dmg, base_hp) {
		return function(lvl) {
			this.maxhp = Math.max(1, Math.round(hp_lvl*lvl + base_hp));
			this.hp = this.maxhp;
			this.damage = Math.max(0, Math.round(dmg_lvl*lvl + base_dmg));
			this.level = lvl;
		}
	}
}

Upgrade.roomba = Upgrade.fromStats(0.9, 2.2, -0.4, 3.6);
Upgrade.shredder = Upgrade.fromStats(2.7, 3.4, 0.4, 3.0);
Upgrade.knife = Upgrade.fromStats(0.5, 3.0, -1.2, 2.2);
Upgrade.fork = Upgrade.fromStats(0.2, 3.9, -1.2, 4.9);
Upgrade.toaster = Upgrade.fromStats(1.5, 0.4, -0.6, 3.6);
Upgrade.wolfercycle = Upgrade.fromStats(1.0, 3.0, -1.0, 3.0);

/* Game handles overall map, engine, scheduler
 * total everything = height + status + msg
 */

var Game = {
    display: null,
    map: {},
    engine: null,
    player: null,
	width: 80,
	height: 24,
	statusWidth: 5,
    msgHistory: [],
	maxBots: 3,
	maxMsg: 5,
	level: 1,

    init: function() {
        this.display = new ROT.Display({width:this.width, 
			height:this.height+this.maxBots+this.maxMsg+1});
        document.body.appendChild(this.display.getContainer());

        this.scheduler = new ROT.Scheduler.Simple();

		var startBot = new Bot(-1,-1, "Wolfercycle",'w', "white",
				10,false, 3, Upgrade.wolfercycle);
		this.player = new Player(-1, -1, startBot);
        
        this._generateMap();

        this.engine = new ROT.Engine(this.scheduler);
        this.engine.start();
    },
    
    _generateMap: function() {
		this.display.clear();
		this.scheduler.clear();
        var digger = new ROT.Map.Digger(this.width, this.height); 
        var freeCells = [];

		this.map = {};
        
        var digCallback = function(x, y, value) {
            if (value) { return; }
            
            var key = x+","+y;
            this.map[key] = [{tile:".", color:"#fff", 
					describe: function() {return "";}}];
            freeCells.push(key);
        }
        digger.create(digCallback.bind(this));
        
        this._drawWholeMap();

		var cor = this.getRandFreeCell(freeCells);

		this.player.x = cor[0];
		this.player.y = cor[1];

		this.map[cor[0]+","+cor[1]].push(this.player);
		this.drawTile(cor[0], cor[1], false);

		this.drawStatus();

		this.scheduler.add(this.player, true);

		var down = this.getRandFreeCell(freeCells);

		// down stair
		this.map[down[0]+","+down[1]] = [{tile:">",color:"#fff",
				describe: function() {return "A stair leading down.";}}];
		this.drawTile(down[0], down[1], false);

		/* Catcher */
		var catchCell = this.getRandFreeCell(freeCells);
		this.map[catchCell[0]+","+catchCell[1]] = [{tile:"!", color:"#a2d",
				describe: function() {return "A catcher.";}}];
		this.drawTile(catchCell[0], catchCell[1], false);

		/* Bot Generation based on level */
		for (var i=0; i<10; i++) {
			var c = this.getRandFreeCell(freeCells);
			var botLevel = Math.max(1,Math.round(
						Math.pow(Game.level,2.0) * ROT.RNG.getUniform()));
			var whichBot = ROT.RNG.getUniform();
			if (whichBot < 0.2) {
				var b = new Bot(c[0],  c[1], "Roomba", "r", "cyan",
						9, true, botLevel, Upgrade.roomba);
			} else if (whichBot < 0.4) {
				var b = new Bot(c[0],  c[1], "Toaster", "t", "orange",
						9, true, botLevel, Upgrade.toaster);
			} else if (whichBot < 0.6) {
				var b = new Bot(c[0], c[1], "fork", "f", "blue",
						9, true, botLevel, Upgrade.fork);
			} else if (whichBot < 0.8) {
				var b = new Bot(c[0], c[1], "knife", "k", "blue",
						9, true, botLevel, Upgrade.knife);
			} else if (whichBot < 0.9) {
				var b = new Bot(c[0], c[1], "shredder", "s", "red",
						9, true, botLevel, Upgrade.shredder);
			} else {
				var b = new Bot(c[0], c[1], "wolfercycle", "w", "yellow",
						9, true, botLevel, Upgrade.wolfercycle);
			}
			this.scheduler.add(b, true);
			var key = b.x+","+b.y;
			this.map[key].push(b);
			this.drawTile(b.x, b.y, false);
		}
    },

	drawStatus: function() {
		for (var i =0; i < this.maxBots; ++i) {
			if (i < this.player.botTeam.length) {
				var bot = this.player.botTeam[i];
				var msg = bot.describe();
				if (i==0) {
					msg += "    " + "Scrap: "+this.player.scrap;
					msg += "    " + "Catchers: " + this.player.catchers;
				}
				this.writeString(this.statusWidth,this.height+i, msg.rpad(" ",70));
			} else {
				this.writeString(this.statusWidth, this.height+i,">".rpad(" ",70));
			}
		}
	},
    
    _drawWholeMap: function() {
        for (var key in this.map) {
            var parts = key.split(",");
            var x = parseInt(parts[0]);
            var y = parseInt(parts[1]);
            this.drawTile(x, y, false);
        }
    },

	drawTile: function(x, y, highlight) {
		var point = this.map[x+","+y].slice(-1)[0];
		if (highlight) {
			this.display.draw(x, y, point.tile, point.color, "#050");
		} else {
			this.display.draw(x, y, point.tile, point.color);
		}
	},

	writeString: function(x,y,msg) {
		for (var i=0; i < msg.length; ++i) {
			this.display.draw(x+i,y,msg[i]);
		}
	},

	addMessage: function(msg) {
		this.msgHistory.push(msg.rpad(" ",65));
		if (this.msgHistory.length > this.maxMsg) {
			// remove oldest message
			this.msgHistory.shift();
		}
		for (var i = 0; i < this.msgHistory.length; ++i) {
			this.writeString(this.statusWidth, this.height+i+this.maxBots,
					this.msgHistory[i]);
		}
	},

	damage: function(attacker, defender, dmg) {
		this.addMessage(
			attacker.name + " dealt " + dmg + " damage to " + defender.name + ".");
		defender.hp = defender.hp - dmg;
		if (defender.hp <= 0) {
			if (defender.wild) {
				defender.die();
			} else {
				this.player.loseBot(defender);
			}
		}
	}
};

var Player = function(x, y, bot) {
    this.x = x;
    this.y = y;
	this.scrap = 0;
	this.catchers = 0;
	this.botTeam = [bot];
	this.name = "You";
	this.tile = "@";
	this.color = "#ff0";
	this.captureMode = false;
	this.examineMode = false;
	this.examineX = x;
	this.examineY = y;
	this.describe = function() {return "";};
}

Player.prototype.gainScrap = function(s) {
	var msg = "You gained "+s+" scrap!";
	var currentBot = this.botTeam[0];
	if (currentBot.hp + s > currentBot.maxhp) {
		msg += "You repair "+(currentBot.maxhp-currentBot.hp)+" hp.";
		//console.log(msg);
		var leftover = s - (currentBot.maxhp - currentBot.hp);
		this.scrap += leftover;
		currentBot.hp = currentBot.maxhp;
	} else {
		currentBot.hp += s;
		msg += "You repair "+ s +" hp.";
		//console.log(msg);
	}
	if (this.scrap >= 10) {
		msg += "you use 10 scrap to upgrade!!";
		currentBot.upgrade(currentBot.level + 1);
		this.scrap -= 10;
	}
	Game.addMessage(msg);
	Game.drawStatus();
}

Player.prototype.loseBot = function(deadBot) {
	Game.addMessage("Lv " + deadBot.level + " " + deadBot.name + " has died!");
	this.botTeam.splice(this.botTeam.indexOf(deadBot),1);
	if (this.botTeam.length == 0) {
		this.die();
	}
}

Player.prototype.act = function() {
    Game.engine.lock();
    window.addEventListener("keydown", this);
}

Player.prototype.handleEvent = function(e) {
    var keyMap = {};
    keyMap[75] = 0; // k
    keyMap[85] = 1; // u
    keyMap[76] = 2; // l
    keyMap[78] = 3; // n
    keyMap[74] = 4; // j
    keyMap[66] = 5; // b
    keyMap[72] = 6; // h
    keyMap[89] = 7; // y


    var code = e.keyCode;
	// console.log("keycode: "+code);
    var dir = ROT.DIRS[8][keyMap[code]];

	if (code == 88) { // x = examine
		this.examineMode = !this.examineMode;
		if (this.examineMode) {
			this.examineX = this.x;
			this.examineY = this.y;
			Game.drawTile(this.examineX, this.examineY, true);
			//console.log("In examine mode.");
		} else {
			Game.drawTile(this.examineX, this.examineY, false);
			//console.log("In play mode.");
		}
		return;
	}

	if (this.examineMode) {
		/* one of vi directions? */
		if (!(code in keyMap)) { return; }
		
		var newX = this.examineX + dir[0];
		var newY = this.examineY + dir[1];
		var newKey = newX+","+newY

		if (!(newKey in Game.map)) { return; }

		var description = Game.map[newKey].slice(-1)[0].describe();
		if (description) {
			Game.addMessage(description);
		}

		Game.drawTile(this.examineX, this.examineY, false);
		Game.drawTile(newX, newY, true);
		this.examineX = newX;
		this.examineY = newY;

		return;
	}

	if (code == 67) { // letter c
		this.captureMode = !this.captureMode;
		Game.addMessage("Capture Mode: "+this.captureMode);
		return;
	}


	if (code == 82) { // r = rotate
		var t = this.botTeam.shift();
		this.botTeam.push(t);
		Game.drawStatus();
		window.removeEventListener("keydown", this);
		Game.engine.unlock();
	}
    /* one of vi directions? */
    if (!(code in keyMap)) { return; }

    /* is there a free space? */
    var newX = this.x + dir[0];
    var newY = this.y + dir[1];
    var newKey = newX + "," + newY;
    if (!(newKey in Game.map)) { return; }

	/* Check for bots */
	var attack = false;
	if (Game.map[newKey].length > 1) { // enemy bot at position
		var bot = Game.map[newKey][1]; // only 1 allow now
		attack = true;
		if (this.captureMode) {
			if (this.catchers < 1) {
				Game.addMessage("You need a Catcher.");
				return;
			}
			// how should this fail? 
			this.capture(bot);
		} else {
			Game.damage(this, bot, this.botTeam[0].damage);
		}
	}
	if (!attack) {
		/* Check for > */
		if (Game.map[newKey][0].tile == ">") {
			Game._generateMap();
			Game.level += 1;
			// ???
		} else {
			if (Game.map[newKey][0].tile == "!") {
				// pickup catcher
				Game.map[newKey][0] = {tile:".", color:"#fff"};
				this.catchers += 1;
				Game.drawStatus();
			}
			Game.map[this.x+","+this.y].pop();
			Game.drawTile(this.x, this.y, false);
			this.x = newX;
			this.y = newY;
			//console.log(Game.map[newKey]);
			Game.map[newKey].push(this);
			Game.drawTile(newX, newY, false);
		}
	}
    window.removeEventListener("keydown", this);
    Game.engine.unlock();
}

Player.prototype.capture = function(bot) {
	/* gets closer to 0 as bot gets weaker */
	var fail = ROT.RNG.getUniform() * bot.hp / bot.maxhp; 

	if (this.botTeam.length == Game.maxBots) {
		Game.addMessage("You can only have " + Game.maxBots + " bots.");
		return;
	}
	// 10% chance to succeed at full hp
	if (0.1 + ROT.RNG.getUniform() < bot.hp / bot.maxhp) {
		Game.addMessage("The Catcher failed!");
	} else {
		bot.wild = false;
		this.botTeam.push(bot);
		Game.addMessage("You captured the Lv " + bot.level + " " + bot.name + "!");
		/* remove from map, remove from scheduler */
		var success = Game.scheduler.remove(bot);  
		// remove youreself == infinite loop!!!!
		var key = bot.x+","+bot.y;
		Game.map[key].pop();
		Game.drawTile(bot.x, bot.y, false);
		this.catchers -= 1;
		Game.drawStatus();
	}
}

Player.prototype.die = function() {
	/* Player dies, game is over */
	alert("You have died.  You made it to level" + Game.level + ". Game over.");
	Game.engine.lock();
	window.removeEventListener("keydown", this);
}

/* A bot needs the following (for now)
 * hp, maxhp
  name
 * symbol, color
 * act()
 * die()
 * scrap max value (?)
 */
var Bot = function(x, y, name, symbol, color, scrap, wild, lvl, upgrade) {
	this.x = x;
	this.y = y;
	this.tile = symbol;
	this.scrap = scrap;
	this.color = color;
	this.name = name;
	this.wild = wild;
	this.upgrade = upgrade;
	this.upgrade(lvl);
}

Bot.prototype.describe = function() {
	return "Lv " + this.level + " " + this.name + "> DMG: "+this.damage+" HP: " + this.hp +"/"+this.maxhp;
}

Bot.prototype.act = function() {
	var x = Game.player.x;
	var y = Game.player.y;
	var passableCallback = function(x, y) {
		return (x+","+y in Game.map);
	}
	var astar = new ROT.Path.AStar(x, y, passableCallback, {topology:8});

	var path = [];
	var pathCallback = function(x,y) {
		path.push([x,y]);
	}
	astar.compute(this.x, this.y, pathCallback);

	path.shift(); /* remove bot's position from the path list */

	if (path.length == 1) {
		Game.damage(this, Game.player.botTeam[0], this.damage);
		Game.drawStatus();
	} else {
		x = path[0][0];
		y = path[0][1];
		// check for lizard
		var oldKey = this.x+","+this.y;
		var newKey = x+","+y;
		// path.length > 4 : too far away to chase, randomly move
		if (path.length > 4 || Game.map[newKey].length > 1) { // something is there
			// try a  random coordinate
			x = this.x + Math.round(ROT.RNG.getUniform() * 3 - 1);
			y = this.y + Math.round(ROT.RNG.getUniform() * 3 - 1);
			var newKey = x+","+y;
			if (!(newKey in Game.map) || Game.map[newKey].length > 1) {  
				// still something
				return;
			}
		}
		// get rid of bot from old position
		Game.map[oldKey].pop();
		Game.drawTile(this.x, this.y, false);
		Game.map[newKey].push(this);
		this.x = x;
		this.y = y;
		Game.drawTile(this.x, this.y, false);
	}
}

Bot.prototype.die = function() {
	/* remove from map, remove from scheduler */
	var msg = "You killed the Lv " + this.level + " " + this.name + ".";
	var success = Game.scheduler.remove(this);
	var key = this.x+","+this.y;
	Game.map[key].pop();
	Game.drawTile(this.x, this.y, false);
	/* Give Scrap */
	var r = Math.round(ROT.RNG.getUniform() * this.scrap);
	Game.addMessage(msg);
	Game.player.gainScrap(r);
}

Game.getRandFreeCell = function(freeCells) {
	var index = Math.floor(ROT.RNG.getUniform() * freeCells.length);
	var key = freeCells.splice(index, 1)[0];
	var parts = key.split(",");
	var x = parseInt(parts[0]);
	var y = parseInt(parts[1]);
	return [x,y];
}
