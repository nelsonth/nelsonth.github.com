
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
	colorHistory: [],
	maxBots: 3,
	maxMsg: 5,
	level: 1,
	aggroRadius: 4,

	player_hl: "#cc9900",
	friendly_hl: "#4d3900",
	examine_hl: "#005500",
	fire_hl: "#669900",

    init: function() {
        this.display = new ROT.Display({width:this.width, 
			height:this.height+this.maxBots+this.maxMsg+1});
        document.body.appendChild(this.display.getContainer());

        this.scheduler = new ROT.Scheduler.Simple();

		var startBot = new Bot(-1,-1, "Wolfercycle",'w', "white",
				10,false, 3, Upgrade.wolfercycle);
		startBot.backcolor = Game.player_hl;
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
            this.map[key] = [{tile:".", color:"#fff", backcolor:"#000", 
					describe: function() {return "";}}];
            freeCells.push(key);
        }
        digger.create(digCallback.bind(this));
        
        this._drawWholeMap();

		for (var i=0; i<this.player.botTeam.length; ++i) {
			var cor = this.getRandFreeCell(freeCells);

			this.player.botTeam[i].x = cor[0];
			this.player.botTeam[i].y = cor[1];

			this.map[cor[0]+","+cor[1]].push(this.player.botTeam[i]);
			this.drawTile(cor[0], cor[1], false);
			this.scheduler.add(this.player.botTeam[i], true);
		}

		this.drawStatus();

		var down = this.getRandFreeCell(freeCells);

		// down stair
		this.map[down[0]+","+down[1]] = [{tile:">",color:"#fff", backcolor:"#000", 
				describe: function() {return "A stair leading down.";}}];
		this.drawTile(down[0], down[1], false);

		/* Catcher */
		var catchCell = this.getRandFreeCell(freeCells);
		this.map[catchCell[0]+","+catchCell[1]] = [{tile:"!", color:"#f7b", backcolor:"#000",
				describe: function() {return "A catcher.";}}];
		this.drawTile(catchCell[0], catchCell[1], false);

		/* Weapon */
		var weaponCell = this.getRandFreeCell(freeCells);
		this.map[weaponCell[0]+","+weaponCell[1]] = [new Ability()];
		this.drawTile(weaponCell[0], weaponCell[1], false);


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
					msg += "    " + "Level: " + this.level;
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
			this.display.draw(x, y, point.tile, point.color, highlight);
		} else {
			this.display.draw(x, y, point.tile, point.color, point.backcolor);
		}
	},

	writeString: function(x,y,msg, color) {
		// console.log("writeString:" + color);
		for (var i=0; i < msg.length; ++i) {
			this.display.draw(x+i,y,msg[i], color);
		}
	},

	addMessage: function(msg, color) { // Colors?
		this.msgHistory.push(msg.rpad(" ",65));
		this.colorHistory.push(color);
		if (this.msgHistory.length > this.maxMsg) {
			// remove oldest message
			this.msgHistory.shift();
			this.colorHistory.shift();
		}
		for (var i = 0; i < this.msgHistory.length; ++i) {
			// console.log('color = ' + color);
			this.writeString(this.statusWidth, this.height+i+this.maxBots,
					this.msgHistory[i], this.colorHistory[i]);
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

Game.distance = function(x0, y0, x1, y1) {
	return Math.max(Math.abs(x0-x1), Math.abs(y0-y1));
}

var Ability = function() {
	this.name = "Grenade";
	this.tile = ")";
	this.color = "#80ffff";
	this.backcolor = "#000000";
	this.damage = 3;
	this.range = 3;
	this.cooldown = 10;
	this.cd_timer = 0;
	this.describe = function() {
		return this.name;
	}
}

var Player = function(x, y, bot) {
    // this.x = x;
    // this.y = y;
	this.scrap = 0;
	this.catchers = 0;
	this.botTeam = [bot];
	this.abilities = [];
	this.name = "You";
	this.tile = "@";
	this.color = "#ff0";
	this.captureMode = false;
	this.uiMode = "play"; // "play", "examine", "scrap"
	this.examineX = x;
	this.examineY = y;
	this.describe = function() {return "";};
    this.keyMap = {};
    this.keyMap[75] = 0; // k
    this.keyMap[85] = 1; // u
    this.keyMap[76] = 2; // l
    this.keyMap[78] = 3; // n
    this.keyMap[74] = 4; // j
    this.keyMap[66] = 5; // b
    this.keyMap[72] = 6; // h
    this.keyMap[89] = 7; // y

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
	// if (this.scrap >= 10) {
		// msg += "you use 10 scrap to upgrade!!";
		// currentBot.upgrade(currentBot.level + 1);
		// this.scrap -= 10;
	// }
	Game.addMessage(msg);
	Game.drawStatus();
}

Player.prototype.loseBot = function(deadBot) {
	Game.addMessage("Lv " + deadBot.level + " " + deadBot.name + " has died!", "red");
	deadBot.die();
	this.botTeam.splice(this.botTeam.indexOf(deadBot),1);
	// console.log("this.botTeam.length: " + this.botTeam.length);
	if (this.botTeam.length == 0) {
		this.die();
	}
}

Player.prototype.act = function() {
    Game.engine.lock();
	
	// rotate team
	this.rotateTeam();

	// reduce cooldown timer for current bot
	var curBot = this.botTeam[0];
	for (var j =0; j < curBot.abilities.length; ++j) {
		if (curBot.abilities[j].cd_timer > 0) {
			curBot.abilities[j].cd_timer -= 1;
		}
	}
    window.addEventListener("keydown", this);
}

Player.prototype.upgradeTopBot = function() {
		if (this.scrap >= 10) {
			Game.addMessage("you use 10 scrap to upgrade!!", "yellow");
			var curBot = this.botTeam[0];
			var oldlvl = curBot.level;
			var oldhp = curBot.maxhp;
			var olddmg = curBot.damage;
			curBot.upgrade(curBot.level + 1);
			var newlvl = curBot.level;
			var newhp = curBot.maxhp;
			var newdmg = curBot.damage;
			var msg = curBot.name + ": ";
			Game.addMessage(msg + "Lv " + oldlvl + " -> " + newlvl, "yellow");
			if (newhp > oldhp) {
				Game.addMessage(msg + "HP " + oldhp + " -> " + newhp, "yellow");
			}
			if (newdmg > olddmg) {
				Game.addMessage(msg + "Dmg " + olddmg + " -> " + newdmg, "yellow");
			}
			
			this.scrap -= 10;
			Game.drawStatus();
		} else {
			Game.addMessage("Not enough scrap to upgrade.");
		}
		// if (this.uiMode != "scrap") {
			// console.log("changing to scrap mode");
			// this.uiMode = "scrap";
		// } else {
			// console.log("changing to play mode");
			// this.uiMode = "play";
		// }
		return;
}

Player.prototype.targetMode = function(code, dir) {
		/* one of vi directions? */
		if (!(code in this.keyMap)) { return; }
		
		var newX = this.examineX + dir[0];
		var newY = this.examineY + dir[1];
		var newKey = newX+","+newY

		if (!(newKey in Game.map)) { return; }

		var curBot = this.botTeam[0];
		var dist = Game.distance(curBot.x, curBot.y, newX, newY);
		var maxRange = curBot.abilities[0].range;
		if (dist > maxRange) {
			Game.addMessage("Max range.");
			return;
		}

		var description = Game.map[newKey].slice(-1)[0].describe();
		if (description) {
			Game.addMessage(description);
		}

		Game.drawTile(this.examineX, this.examineY, false);
		Game.drawTile(newX, newY, Game.fire_hl);
		this.examineX = newX;
		this.examineY = newY;

		return;
}

Player.prototype.rotateTeam = function() {
	var t = this.botTeam.shift();
	t.backcolor = Game.friendly_hl;
	Game.drawTile(t.x, t.y, false);
	this.botTeam.push(t);
	this.botTeam[0].backcolor = Game.player_hl;
	Game.drawStatus();
	Game.drawTile(this.botTeam[0].x, this.botTeam[0].y, false);
}

Player.prototype.fireAbility = function() {
	// add weapon info, Game.damage()
	Game.addMessage("You fired!");
	targetKey = this.examineX + "," + this.examineY;
	if (Game.map[targetKey].length > 1) {
		// bot at location
		var enemy = Game.map[targetKey].slice(-1)[0];
		var curAbility = this.botTeam[0].abilities[0];
		// fix
		Game.damage(this, enemy, curAbility.damage);
		curAbility.cd_timer = curAbility.cooldown;
	}
	this.uiMode = "play";
	Game.drawTile(this.examineX, this.examineY, false);
	window.removeEventListener("keydown", this);
	Game.engine.unlock();
}

Player.prototype.handleEvent = function(e) {

    var code = e.keyCode;
	// console.log("keycode: "+code);
	// BAD PLACE???
    var dir = ROT.DIRS[8][this.keyMap[code]];

	if (code == 83) { // s = scrap
		this.upgradeTopBot();
		return;
	}

	if (code == 27) { // esc = back to play mode
		this.uiMode = "play";
		Game.drawTile(this.examineX, this.examineY, false);
		return;
	}

	// if (code == 79) { // o = orders
		// if (this.uiMode == "play") {
			// this.uiMode = "orders: choose bot";
			// Game.addMessage("Orders for bot 1, 2, or 3?", "green");
			// return;
		// } else {
			// Game.addMessage("Can't order from mode " + this.uiMode);
			// return;
		// }
	// }

	if (code == 65) { // a = ability upgrade
		if (this.scrap >= 30) {
			a = this.abilities.pop();
			this.botTeam[0].abilities.push(a);
			Game.addMessage("Gave " + this.botTeam[0].name + " " + a.name + "!",
					"yellow");
			Game.addMessage("Press f to fire.", "yellow");
			this.scrap -= 30;
			Game.drawStatus();
		} else {
			Game.addMessage("You need 30 scrap to attach that weapon.");
		}
		return;
	}

	if (code == 88) { // x = examine
		if (this.uiMode == "examine") {
			this.uiMode = "play";
		} else {
			this.uiMode = "examine";
		}
		if (this.uiMode == "examine") {
			this.examineX = this.botTeam[0].x;
			this.examineY = this.botTeam[0].y;
			Game.drawTile(this.examineX, this.examineY, Game.examine_hl);
			//console.log("In examine mode.");
		} else {
			Game.drawTile(this.examineX, this.examineY, false);
			//console.log("In play mode.");
		}
		return;
	}

	if (this.uiMode == "examine") {
		/* one of vi directions? */
		if (!(code in this.keyMap)) { return; }
		
		var newX = this.examineX + dir[0];
		var newY = this.examineY + dir[1];
		var newKey = newX+","+newY

		if (!(newKey in Game.map)) { return; }

		var description = Game.map[newKey].slice(-1)[0].describe();
		if (description) {
			Game.addMessage(description);
		}

		Game.drawTile(this.examineX, this.examineY, false);
		Game.drawTile(newX, newY, Game.examine_hl);
		this.examineX = newX;
		this.examineY = newY;

		return;
	}

	if (code == 70) { // f = fire
		if (this.uiMode == "fire") {
			this.fireAbility();
			return;
		} else {
			if (this.botTeam[0].abilities.length < 1) {
				Game.addMessage("This bot has nothing to fire.");
				return;
			}
			var cd_timer = this.botTeam[0].abilities[0].cd_timer;
			if (cd_timer > 0) {
				Game.addMessage("Weapon on cooldown: " + cd_timer);
				return;
			}
			this.uiMode = "fire";
			Game.addMessage("f again to fire, Esc to cancel.");
			this.examineX = this.botTeam[0].x;
			this.examineY = this.botTeam[0].y;
			Game.drawTile(this.examineX, this.examineY, Game.fire_hl);
			return;
		}
	}

	if (this.uiMode == "fire") {
		this.targetMode(code, dir);
		return;
	}

	if (code == 67) { // letter c
		this.captureMode = !this.captureMode;
		Game.addMessage("Capture Mode: "+this.captureMode);
		return;
	}


	if (code == 82) { // r = rotate (essentially a pause now)
		window.removeEventListener("keydown", this);
		Game.engine.unlock();
		return;
	}

    /* one of vi directions? */
    if (!(code in this.keyMap)) { return; }

    /* is there a free space? */
    var newX = this.botTeam[0].x + dir[0];
    var newY = this.botTeam[0].y + dir[1];
    var newKey = newX + "," + newY;
    if (!(newKey in Game.map)) { return; }

	/* Check for bots */
	var attack = false;
	if (Game.map[newKey].length > 1) { // bot at position
		var bot = Game.map[newKey][1]; // only 1 allow now
		if (!bot.wild) {
			// an ally
			Game.addMessage("You bump into your bot.");
			return;
		}
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
				Game.map[newKey][0] = {tile:".", color:"#fff", backcolor:"#000"};
				this.catchers += 1;
				Game.drawStatus();
			} else if (Game.map[newKey][0].tile == ")") {
				var a = Game.map[newKey][0];
				// pickup ability
				Game.map[newKey][0] = {tile:".", color:"#fff", backcolor:"#000"};
				this.abilities.push(a);
				Game.addMessage("Picked up " + a.name + ".  Press a to use.");
			}
			Game.map[this.botTeam[0].x+","+this.botTeam[0].y].pop();
			Game.drawTile(this.botTeam[0].x, this.botTeam[0].y, false);
			this.botTeam[0].x = newX;
			this.botTeam[0].y = newY;
			//console.log(Game.map[newKey]);
			Game.map[newKey].push(this.botTeam[0]);
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
		bot.backcolor = Game.friendly_hl;
		Game.drawTile(bot.x, bot.y, false);
		this.botTeam.push(bot);
		Game.addMessage("You captured the Lv " + bot.level + " " + bot.name + "!", 
				"orange");
		this.catchers -= 1;
		this.captureMode = false;
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
	this.abilities = [];
	this.x = x;
	this.y = y;
	this.tile = symbol;
	this.scrap = scrap;
	this.color = color;
	this.name = name;
	this.wild = wild;
	this.goal = "player";
	this.upgrade = upgrade;
	this.upgrade(lvl);
}

Bot.prototype.describe = function() {
	return "Lv " + this.level + " " + this.name + "> DMG: "+this.damage+" HP: " + this.hp +"/"+this.maxhp;
}

Bot.prototype.act = function() {
	if (!this.wild) {
		if (this.goal == "player") {
			Game.player.act(); // could maybe pass bot here?
		}
		return;
	}

	var mindist = 64; // a big number
	var botIndex = -1;
	for (var i=0; i < Game.player.botTeam.length; ++i) {
		var b = Game.player.botTeam[i]
		var d = Game.distance(this.x, this.y, b.x, b.y)
		if (mindist > d)  {
			mindist = d;
			botIndex = i;
		}
	}

	var x = Game.player.botTeam[botIndex].x;
	var y = Game.player.botTeam[botIndex].y;
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
		Game.damage(this, Game.player.botTeam[botIndex], this.damage);
		Game.drawStatus();
	} else {
		x = path[0][0];
		y = path[0][1];
		// check for bot at location
		var oldKey = this.x+","+this.y;
		var newKey = x+","+y;
		if (mindist > Game.aggroRadius || Game.map[newKey].length > 1) { 
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
	Game.addMessage(msg, "red");
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
