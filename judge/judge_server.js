/**
 * Created by 明阳 on 2015/3/23.
 */

var crypto = require('crypto');
var log = require('./log');

function judge_server (data, callback) {

    // 初始化

    this.name = data.name;
    this.secret_key = data.secret_key;
    this.create_time = data.create_time;
    this.socket = undefined;
    this.address = undefined;
    this.status = undefined; //代表有没有被连接
    this.connect_time = undefined;
    this.log = new log(data.log_path);

    var self = this;

    //初始化结束

    this.check = function (data, callback) { //进行身份验证
        var result;
        var localtoken = crypto
            .createHash('sha1')
            .update(self.secret_key+'$'+data.post_time)
            .digest('hex');
        result = (localtoken === data.token);
        if(callback) callback();
        return result;
    };


    this.log_in = function (socket, data, callback) {

        if(!self.check(data)) {
            callback(new Error('Token mismatch'));
            self.log.write('Token mismatch');
            return;
        }

        if(self.status) {
            callback(new Error('Already has a socket'));
            return ;
        } else {
            self.status = data.status;
        }
        self.socket = socket;
        self.socket
            .on('disconnect', function () {
                self.log.write("Disconnected!");
                self.status = undefined;
            })
            .on('status', function (status, conform) {
                self.status = status;
                conform();
            })
            .on('file', function (task, conform) {
                //TODO : 传输文件去
            })
            .on('report', function (status, task, conform) {
                console.log('Got a report from client.');
            });
        self.connect_time = new Date();
        self.log.write('Logged in');
        if(callback)callback();
    };


    this.get_task = function (task, callback) {
        self.socket.emit('task', task, function() {
            self.log.write('Sent task to client');
            if(callback)callback();
        });
    };

    if(callback) callback();
}

function judge_servers (configs, callback) {
    this.configs = configs;
    this.judges = {};
    var self = this;
    // 根据configs进行初始化
    configs.forEach(function(ele, index) {
        self.judges[ele.name] = new judge_server(ele);
    });
    // 初始化结束，调用回调函数
    if(callback)callback();

    this.log_in = function (socket, data, confirm) { //处理客户端发来的登陆请求
        if(self.judges[data.name])
            self.judges[data.name].log_in(socket, data, confirm);
        else {
            confirm(new Error('Unknown judge_name, please STOP.'));
            //self.stop(); //TODO: 让评测机停止工作
        }
    };

    this.get_task = function (task, confirm) { // 得到了一个任务之后进行分配
        var choose = self.configs[Math.random()*configs.length].name;
        console.log('The task sent forward to ',choose);
        self.judges[choose].get_task(task, confirm);
    };

}

module.exports = judge_servers;