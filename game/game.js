/* Game handles overall map, engine, scheduler
 * total everything = height + status + msg
 */

var Upgrade = {
	wolfercycle: function(lvl) {
		this.maxhp = 6 + 3 * lvl;
		this.hp = this.maxhp; // free hp refill on level up
		this.damage = lvl;
		this.level = lvl;
	},

	lizard: function(lvl) {
		this.maxhp = -1 + 4 * lvl;
		this.hp = this.maxhp;
		this.damage = lvl;
		this.level = lvl;
	}
}

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
				10,false, 1, Upgrade.wolfercycle);
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
            this.map[key] = ["."];
            freeCells.push(key);
        }
        digger.create(digCallback.bind(this));
        
        this._drawWholeMap();

		var cor = this.getRandFreeCell(freeCells);

		this.player._x = cor[0];
		this.player._y = cor[1];

		this.player.draw();

		this.drawStatus();

		this.scheduler.add(this.player, true);

		var down = this.getRandFreeCell(freeCells);

		// down stair
		this.map[down[0]+","+down[1]] = [">"];
		this.display.draw(down[0], down[1], ">");

		/* Cage?  Virus?  Reprogrammer? */
		var reproCell = this.getRandFreeCell(freeCells);
		this.map[reproCell[0]+","+reproCell[1]] = ["!"];
		this.display.draw(reproCell[0], reproCell[1], "!", "#a2d");

		/* Lizard Generation based on level */
		for (var i=0; i<10; i++) {
			var c = this.getRandFreeCell(freeCells);
			/* Lizards */
			var lizardLevel = Math.max(1,Math.round(
						Math.pow(Game.level,2.0) * ROT.RNG.getUniform()));
			var b = new Bot(c[0],  c[1], "Lizard", "l", "cyan",
					9, true, lizardLevel, Upgrade.lizard);
			this.scheduler.add(b, true);
			var key = b._x+","+b._y;
			this.map[key].push(b);
		}
    },

	drawStatus: function() {
		for (var i =0; i < this.maxBots; ++i) {
			if (i < this.player.botTeam.length) {
				var bot = this.player.botTeam[i];
				var msg = "Lv " + bot.level + " " + bot.name + "> " + 
					"HP: "+bot.hp+"/" + bot.maxhp ;
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
            this.display.draw(x, y, this.map[key][0]);
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
    this._x = x;
    this._y = y;
	this.scrap = 0;
	this.catchers = 0;
	this.botTeam = [bot];
	this.name = "You";
	this.captureMode = false;
}

Player.prototype.getX = function() { return this._x;}
Player.prototype.getY = function() { return this._y;}

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
    var dir = ROT.DIRS[8][keyMap[code]];
    var newX = this._x + dir[0];
    var newY = this._y + dir[1];
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
		if (Game.map[newKey] == ">") {
			Game._generateMap();
			Game.level += 1;
			// ???
		} else {
			if (Game.map[newKey] == "!") {
				// pickup catcher
				Game.map[newKey] = ".";
				this.catchers += 1;
				Game.drawStatus();
			}
			Game.display.draw(this._x, this._y, Game.map[this._x+","+this._y][0]);
			this._x = newX;
			this._y = newY;
			this.draw();
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
		var key = bot._x+","+bot._y;
		Game.map[key].pop();
		Game.display.draw(bot._x, bot._y, Game.map[key][0]);
		this.catchers -= 1;
		Game.drawStatus();
	}
}

Player.prototype.draw = function() {
    Game.display.draw(this._x, this._y, "@", "#ff0");
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
	this._x = x;
	this._y = y;
	this.symbol = symbol;
	this.scrap = scrap;
	this.color = color;
	this.draw();
	this.level = lvl;
	this.name = name;
	this.wild = wild;
	this.upgrade = upgrade;
	this.upgrade(this.level);
}

Bot.prototype.draw = function() {
	Game.display.draw(this._x, this._y, this.symbol, this.color);
}

Bot.prototype.act = function() {
	var x = Game.player.getX();
	var y = Game.player.getY();
	var passableCallback = function(x, y) {
		return (x+","+y in Game.map);
	}
	var astar = new ROT.Path.AStar(x, y, passableCallback, {topology:8});

	var path = [];
	var pathCallback = function(x,y) {
		path.push([x,y]);
	}
	astar.compute(this._x, this._y, pathCallback);

	path.shift(); /* remove bot's position from the path list */

	if (path.length == 1) {
		Game.damage(this, Game.player.botTeam[0], this.damage);
		Game.drawStatus();
	} else {
		x = path[0][0];
		y = path[0][1];
		// check for lizard
		var oldKey = this._x+","+this._y;
		var newKey = x+","+y;
		if (Game.map[newKey].length == 1) { // nothing is there
			// get rid of bot from old position
			Game.map[oldKey].pop();
			Game.display.draw(this._x, this._y, Game.map[oldKey][0]);
			Game.map[newKey].push(this);
			this._x = x;
			this._y = y;
			this.draw();
		}
	}
}

Bot.prototype.die = function() {
	/* remove from map, remove from scheduler */
	var msg = "You killed the Lv " + this.level + " " + this.name + ".";
	var success = Game.scheduler.remove(this);
	var key = this._x+","+this._y;
	Game.map[key].pop();
	Game.display.draw(this._x, this._y, Game.map[key][0]);
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
