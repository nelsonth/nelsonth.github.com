var Game = {
    display: null,
    map: {},
	bots: [],
	sheduler: null,
    engine: null,
    player: null,
	width: 80,
	height: 30,
	statusWidth: 15,
	statusHeight: 24,
    msgHistory: [],

    init: function() {
        this.display = new ROT.Display({width:this.width, height:this.height});
        document.body.appendChild(this.display.getContainer());

        this.scheduler = new ROT.Scheduler.Simple();
        
        this._generateMap();

        this.scheduler.add(this.player, true);

		this.drawStatus();

        this.engine = new ROT.Engine(this.scheduler);
        this.engine.start();
    },
    
    _generateMap: function() {
		// taking off 6 lines for display
        var digger = new ROT.Map.Digger(this.width, this.height-6); 
        var freeCells = [];
        
        var digCallback = function(x, y, value) {
            if (value) { return; }
            
            var key = x+","+y;
            this.map[key] = ["."];
            freeCells.push(key);
        }
        digger.create(digCallback.bind(this));
        
        // this._generateBots(freeCells);
        this._drawWholeMap();

		this.player = this._createBeing(Player, freeCells);
		for (var i=0; i<10; i++) {
			var b = this._createBeing(Lizard, freeCells);
			this.scheduler.add(b, true);
			this.bots.push(b); // leaving this for now
			var key = b._x+","+b._y;
			this.map[key].push(b);
		}
    },

	drawStatus: function() {
		this.display.draw(this.statusWidth,this.statusHeight,this.player.hp);
		this.writeString(this.statusWidth,this.statusHeight,
				"HP: "+this.player.hp+"/" + this.player.maxhp + "     " +
				"Scrap: "+this.player.scrap);
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
		if (this.msgHistory.length > 5) {
			// remove oldest message
			this.msgHistory.shift();
		}
		for (var i = 0; i < this.msgHistory.length; ++i) {
			this.writeString(this.statusWidth, this.statusHeight+i+1,
					this.msgHistory[i]);
		}
	},

	damage: function(attacker, defender, dmg) {
		this.addMessage(
			attacker.name + " dealt " + dmg + " damage to " + defender.name + ".");
		defender.hp = defender.hp - dmg;
		if (defender.hp <= 0) {
			defender.die();
		}
	}
};

var Player = function(x, y) {
    this._x = x;
    this._y = y;
    this._draw();
	this.hp = 9;
	this.maxhp = 9;
	this.scrap = 0;
	this.damage = 1;
	this.name = "You";
}

Player.prototype.getX = function() { return this._x;}
Player.prototype.getY = function() { return this._y;}

Player.prototype.gainScrap = function(s) {
	var msg = "You gained "+s+" scrap!";
	if (this.hp + s > this.maxhp) {
		msg += "You repair "+(this.maxhp-this.hp)+" hp.";
		console.log(msg);
		var leftover = s - (this.maxhp - this.hp);
		this.scrap += leftover;
		this.hp = this.maxhp;
	} else {
		this.hp + s;
		msg += "You repair "+ s +" hp.";
		console.log(msg);
	}
	if (this.scrap >= 10) {
		msg += "you use 10 scrap to upgrade!!";
		this.maxhp += 3;
		this.damage += 1;
		this.scrap -= 10;
	}
	Game.addMessage(msg);
	Game.drawStatus();
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
	/*
	if (code == 188) { // ,
		this._checkBox();
		return;
	}
	*/
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
	for (var i=0; i < Game.bots.length; ++i) {
		var bot = Game.bots[i];
		if (newX == bot._x && newY == bot._y) {
			Game.damage(this, bot, this.damage);
			attack = true;
		}
	} 
	if (!attack) {
		Game.display.draw(this._x, this._y, Game.map[this._x+","+this._y][0]);
		this._x = newX;
		this._y = newY;
		this._draw();
	}
    window.removeEventListener("keydown", this);
    Game.engine.unlock();
}

Player.prototype._draw = function() {
    Game.display.draw(this._x, this._y, "@", "#ff0");
}    

Player.prototype.die = function() {
	/* Player dies, game is over */
	alert("You have died.  Game over.");
	Game.engine.lock();
	window.removeEventListener("keydown", this);
}

var Lizard = function(x, y) {
	this._x = x;
	this._y = y;
	this.hp = 3;
	this.maxhp = 3;
	this._draw();
	this.name = "Lizard";
}

Lizard.prototype._draw = function() {
	Game.display.draw(this._x, this._y, "l", "cyan");
}

Lizard.prototype.act = function() {
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

	path.shift(); /* remove lizard's position from the path list */

	if (path.length == 1) {
		Game.damage(this, Game.player, 1);
		Game.drawStatus();
	} else {
		x = path[0][0];
		y = path[0][1];
		// check for lizard
		var oldKey = this._x+","+this._y;
		var newKey = x+","+y;
		if (Game.map[newKey].length == 1) { // nothing is there
			// get rid of lizard from old position
			Game.map[oldKey].pop();
			Game.display.draw(this._x, this._y, Game.map[oldKey][0]);
			Game.map[newKey].push(this);
			this._x = x;
			this._y = y;
			this._draw();
		}
	}
}

Lizard.prototype.die = function() {
	/* remove from map, remove from scheduler */
	var msg = "You killed the Lizard!";
	var success = Game.scheduler.remove(this);
	// console.log("removed lizard: " + success);
	var key = this._x+","+this._y;
	Game.map[key].pop();
	Game.display.draw(this._x, this._y, Game.map[key][0]);
	/* remove lizard from bot list */
	Game.bots.splice(Game.bots.indexOf(this),1);
	/* Give Scrap */
	var r = Math.round(ROT.RNG.getUniform() * 10);
	Game.addMessage(msg);
	Game.player.gainScrap(r);
}

Game._createBeing = function(what, freeCells) {
	var index = Math.floor(ROT.RNG.getUniform() * freeCells.length);
	var key = freeCells.splice(index, 1)[0];
	var parts = key.split(",");
	var x = parseInt(parts[0]);
	var y = parseInt(parts[1]);
	return new what(x,y);
}
