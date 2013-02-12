
/**
 * Module dependencies.
 */

var express = require('express')
  , http = require('http')
  , path = require('path')
  , cheerio = require('cheerio')
  , request = require('request')
  , url = require('url')
  , monster = require('./monsterList')
  , monsters = require('./monsters')
  , fs = require('fs')
  , mongoose = require('mongoose');

var app = express();

app.configure(function(){
  app.set('port', process.env.PORT || 3000);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
  app.use(express.errorHandler());
});

var mongoUri = 'mongodb://pad2013:pad2013@ds043467.mongolab.com:43467/pad';
var mongoUri2 = 'mongodb://pad:pad2013@ds037837.mongolab.com:37837/pad';
var mongoUri3 = 'mongodb://pad:pad2013@linus.mongohq.com:10061/pad';
mongoose.connect(mongoUri2);
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'db connection error:'));

var Schema = mongoose.Schema;
// monster_jp 정의
var monsterSchema = new Schema({
  no : String,
  name : String,
  image_url : String,
  info : {
    mon_type : String,
    attr_main : String,
    attr_sub : String,
    rare : Number,
    cost : Number,
    max_lv : Number,
    exp_type : String
  },
  status : {
    min_hp : Number,
    min_attack : Number,
    min_recovery : Number,
    min_total : Number,
    max_hp : Number,
    max_attack : Number,
    max_recovery : Number,
    max_total : Number
  },
  skill : {
    skill : String,
    max_lv : String,
    f_turn : String,
    l_turn : String,
    effect : String,
    leader_skill : String,
    leader_effect : String
  },
  howget : {
    friend_egg : String,
    rare_egg : String,
    other : String,
    drop : String
  }
});

monsterSchema.methods.addLog = function() {
  console.log('New monster added');
  console.log(JSON.stringify(this));
};
var Monster = mongoose.model('monster_jp', monsterSchema, 'monster_jp');

// http://pd.appbank.net/ 에서 데이터 가져오기 (진화 Only)
var getDataFromOne = function(no, callback) {
  request({
    uri: 'http://pd.appbank.net/m' + no
  }, function(err, response, body) {
    var self = this;
    
    if (err && response.statusCode !== 200) {
      console.log('Request error');
    }

    var $ = cheerio.load(body);
    var $body = $('body');
    var $p = $body.find('#left p');
    $p.each(function(i, item) {
      if (i === 4) {
        var $item = $(item);
        
        // 진화전, 진화후, 진화재료로 나누기
        var evol_html = $item.html().split('<br>');
        var before = '';
        var after = '';
        var sources = '';

        for (var j = 0; j < evol_html.length; j++) {
          // console.log(j + ':' + evol_html[j].trim());
          var evol_el = evol_html[j].split(':');
          for (var k = 0; k < evol_el.length; k++) {
            if (evol_el[k].trim() === '進化前')
              before = evol_el[k+1].trim();
            else if (evol_el[k].trim() === '進化後')
              after = evol_el[k+1].trim();
            else if (evol_el[k].trim() === '進化素材')
              sources = evol_el[k+1].trim();
          }
        }

        // console.log('before [' + before + ']');
        // console.log('after [' + after + ']');
        // console.log('sources [' + sources + ']');

        // 번호만 따오기
        // before
        if (before != '') {
          $ = cheerio.load(before);
          var before_mon = $('a').attr('href').substr(2,3);  
        } else {
          var before_mon = '-';
        }
        
        // after
        if (after != '' && after != 'なし') {
          $ = cheerio.load(after);
          var after_mon = $('a').attr('href').substr(2,3);  
        } else {
          var after_mon = '-';
        }
        
        // source
        if (sources != '') {
          $ = cheerio.load(sources);
          var source = new Array();
          $('a').each(function(i, item) {
            source[i] = $(this).attr('href').substr(2,3)
          });  
        } else {
          var source = '-';
        }
        
        // console.log(source.join(', '));
        var result = {
          no : no,
          before : before_mon,
          after : after_mon,
          sources : source
        };
        // console.log(result);
        callback(result);
      }
    });
  });
}

// http://appwood.net/pad/ 에서 데이터 가져오기 (모든 정보)
var getDataFromTwo = function(url, callback) {
  request({
    uri: url
  }, function(err, response, body) {
    var self = this;
  
    if (err && response.statusCode !== 200) {
      console.log('Request error');
    }

    var $ = cheerio.load(body);
    var $body = $('body');
    // 몬스터 이름
    var name = $body.find('.post .title').text();
    // 몬스터 큰 이미지
    var image_url = $body.find('.image').find('img').attr('src');
    // 기본정보
    var $info = $body.find('.status .col4 td');
    var info = {
      mon_type : $($info[1]).text(),
      attr_main : $($info[2]).text(),
      attr_sub : $($info[3]).text(),
      rare : $($info[4]).text().substr(1,1),
      cost : $($info[5]).text(),
      max_lv : $($info[6]).text(),
      exp_type : $($info[7]).text().substr(0,3)
    };
    // 스테이터스
    var $status = $body.find('.status .col6 td');
    var status = {
      min_hp : $($status[1]).text(),
      min_attack : $($status[2]).text(),
      min_recovery : $($status[3]).text(),
      min_total : $($status[4]).text(),
      max_hp : $($status[7]).text(),
      max_attack : $($status[8]).text(),
      max_recovery : $($status[9]).text(),
      max_total : $($status[10]).text()
    };
    // 스킬
    var $skill = $body.find('.skill-table td');
    var skill = {
      skill : $($skill[0]).text(),
      max_lv : $($skill[1]).text(),
      f_turn : $($skill[2]).text(),
      l_turn : $($skill[3]).text(),
      effect : $($skill[4]).text(),
      leader_skill : $($skill[5]).text(),
      leader_effect : $($skill[6]).text()
    };
    // TODO 진화부분은 다른 홈피쪽에서 가져올것
    // var evolutions = $body.find('.evol-table td');
    // var evolution = {
    //   before : $(evolutions[0]).find('a').attr('href'),
    //   after : $(evolutions[1]).find('a').attr('href'),
    //   element : $(evolutions[2]).find('a').attr('href')
    // };
    // 입수방법
    var $get = $body.find('.get-table td');
    var get = {
      friend_egg : $($get[0]).text(),
      rare_egg : $($get[1]).text(),
      other : $($get[2]).text(),
      drop : $($get[3]).text()
    };

    var result = {
      no : $($info[0]).text(),
      name : name,
      image_url : image_url,
      info : info,
      status : status,
      skill : skill,
      howget : get
    };

    callback(result);
  });
}

http.createServer(app).listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});

app.get('/', function(req, res) {
  // var log = fs.createWriteStream('log.txt', {'flags': 'a'});
  // for (var i=0; i < monsters.list.length; i++) {
  monsters.list.forEach(function(monster) {
    // console.log(i + '/' + monster.list.length);
    var newMonster = new Monster();
    newMonster.no = monster.no;
    newMonster.name = monster.name;
    newMonster.image_url = monster.image_url;
    newMonster.info.mon_type = monster.info.mon_type;
    newMonster.info.attr_main = monster.info.attr_main;
    newMonster.info.attr_sub = monster.info.attr_sub;
    newMonster.info.rare = monster.info.rare;
    newMonster.info.cost = monster.info.cost;
    newMonster.info.max_lv = monster.info.max_lv;
    newMonster.info.exp_type = monster.info.exp_type;
    newMonster.status.min_hp = monster.status.min_hp;
    newMonster.status.min_attack = monster.status.min_attack;
    newMonster.status.min_recovery = monster.status.min_recovery;
    newMonster.status.min_total = monster.status.min_total;
    newMonster.status.max_hp = monster.status.max_hp;
    newMonster.status.max_attack = monster.status.max_attack;
    newMonster.status.max_recovery = monster.status.max_recovery;
    newMonster.status.max_total = monster.status.max_total;
    newMonster.skill.skill = monster.skill.skill;
    newMonster.skill.max_lv = monster.skill.max_lv;
    newMonster.skill.f_turn = monster.skill.f_turn;
    newMonster.skill.l_turn = monster.skill.l_turn;
    newMonster.skill.effect = monster.skill.effect;
    newMonster.skill.leader_skill = monster.skill.leader_skill;
    newMonster.skill.leader_effect = monster.skill.leader_effect;
    newMonster.howget.friend_egg = monster.howget.friend_egg;
    newMonster.howget.rare_egg = monster.howget.rare_egg;
    newMonster.howget.other = monster.howget.other;
    newMonster.howget.drop = monster.howget.drop;

    newMonster.save(function(err, newMonster) {
      if (err) {
        console.error(err);
        return false;
      }
      newMonster.addLog();
    });
  });
    // console.log(monster.list[i].no);
    // getDataFromOne(monster.list[i].no, function(result) {
    //   // ev.push(result);    
    //   fs.appendFileSync('log.txt', JSON.stringify(result) + ', ');
    // });
    // getDataFromTwo(monster.list[i].href, function(result) {
      // console.log(i + '/' + monster.list.length);
      // var newMonster = new Monster();
      // newMonster.no = monsters.list[i].no;
      // newMonster.name = monsters.list[i].name;
      // newMonster.image_url = monsters.list[i].image_url;
      // newMonster.info.mon_type = monsters.list[i].info.mon_type;
      // newMonster.info.attr_main = monsters.list[i].info.attr_main;
      // newMonster.info.attr_sub = monsters.list[i].info.attr_sub;
      // newMonster.info.rare = monsters.list[i].info.rare;
      // newMonster.info.cost = monsters.list[i].info.cost;
      // newMonster.info.max_lv = monsters.list[i].info.max_lv;
      // newMonster.info.exp_type = monsters.list[i].info.exp_type;
      // newMonster.status.min_hp = monsters.list[i].status.min_hp;
      // newMonster.status.min_attack = monsters.list[i].status.min_attack;
      // newMonster.status.min_recovery = monsters.list[i].status.min_recovery;
      // newMonster.status.min_total = monsters.list[i].status.min_total;
      // newMonster.status.max_hp = monsters.list[i].status.max_hp;
      // newMonster.status.max_attack = monsters.list[i].status.max_attack;
      // newMonster.status.max_recovery = monsters.list[i].status.max_recovery;
      // newMonster.status.max_total = monsters.list[i].status.max_total;
      // newMonster.skill.skill = monsters.list[i].skill.skill;
      // newMonster.skill.max_lv = monsters.list[i].skill.max_lv;
      // newMonster.skill.f_turn = monsters.list[i].skill.f_turn;
      // newMonster.skill.l_turn = monsters.list[i].skill.l_turn;
      // newMonster.skill.effect = monsters.list[i].skill.effect;
      // newMonster.skill.leader_skill = monsters.list[i].skill.leader_skill;
      // newMonster.skill.leader_effect = monsters.list[i].skill.leader_effect;
      // newMonster.howget.friend_egg = monsters.list[i].howget.friend_egg;
      // newMonster.howget.rare_egg = monsters.list[i].howget.rare_egg;
      // newMonster.howget.other = monsters.list[i].howget.other;
      // newMonster.howget.drop = monsters.list[i].howget.drop;

      // setTimeout(addNew(newMonster), 2000);
      // newMonster.save(function(err, newMonster) {
      //   if (err) console.error(err);
      //   newMonster.addLog();
      // });
      // fs.appendFileSync('monster.txt', JSON.stringify(result) + ', ');
    // });
  // }
});
// function addNew(newMonster) {
//   newMonster.save(function(err, newMonster) {
//     if (err) console.error(err);
//     newMonster.addLog();
//   });
// }