//録音ボタン押下フラグ
var cFlag = false;
var recorder = null;
var audioContext;
var lowpassFilter = null;

// Compatibility shim :
// CSS3で実装される機能が先行実装されてる際に各ブラウザ毎にその利用を宣言する必要があるが、それぞれの宣言方法（ベンダープレフィックス）を吸収するためのコード。
navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia
		|| navigator.mozGetUserMedia;

// PeerJS object の生成（Peerコネクション生成、受信のために利用） new Peer(APIkey , Options);
var peer = new Peer({
	// APIKeyはクラウド上のPeerServerを利用するためのキー
	key : '2778d7da-f4f6-11e3-8ed2-8320f6a5c7b7',
	// エラー時に全てのログを出力するオプション
	debug : 3
});

// Peerオブジェクトは生成時、ランダムなIPが割り振られる。
// 'open' PeerServerへの接続が確立すると発生
peer.on('open', function() {
	$('#my-id').text(peer.id);
	console.log('My peer id:' + peer.id)
});

// Receiving a call
// リモートPeerが自分に発信してきた時の処理
peer.on('call', function(call) {
	// Answer the call automatically (instead of prompting user) for demo
	// purposes
	call.answer(window.localStream);
	step3(call);
});

// Peerに対するエラー時に発生。ソケットやPeerConectionから生じるエラー
peer.on('error', function(err) {
	alert(err.message);
	// Return to step 2 if error occurs
	step2();
});

// Click handlers setup
$(function() {

	// Callボタンがクリックされた際に発生
	$('#make-call').click(function() {
		// Initiate a call!
		// peer.call(相手のID,何らかのストリーム)
		var call = peer.call($('#callto-id').val(), window.localStream);

		step3(call);
	});

	// Hang upボタンがクリックされた際に発生
	$('#end-call').click(function() {
		window.existingCall.close();
		step2();
	});

	// Retry if getUserMedia fails
	$('#step1-retry').click(function() {
		$('#step1-error').hide();
		step1();
	});

	// Get things started
	step1();
});

$(document).ready(function() {
	var ua = navigator.userAgent;

	$("#captureButton").mousedown(function() {
		captureStart();
	});
	$("#captureButton").mouseup(function() {
		captureStop();
	});

});

// 再生ボタン、ダウンロードボタンの生成
var wavExported = function(blob) {
	var url = URL.createObjectURL(blob);
	var fname = new Date().toISOString() + '.wav';
	console.log(url);

	$('#files')
			.append(
					'<li>'
							+ '<span style="font-size:20px">'
							+ fname
							+ '</span>'
							+ ' <a onclick="wavPlay(\''
							+ url
							+ '\');"><button type="button" class="btn btn-default btn-lg">再生</button></a>'
							+ ' <a href="'
							+ url
							+ '" download="'
							+ fname
							+ '"><button id="captureButton" type="button" class="btn btn-default btn-lg">Download</button></a>'
							+ '<br>');

	recorder.clear();
}

// 再生
var wavPlay = function(url) {
	var request = new XMLHttpRequest();
	request.open('GET', url, true);
	request.responseType = 'arraybuffer';

	request.onload = function() {
		audioContext.decodeAudioData(request.response, function(buffer) {
			var source = audioContext.createBufferSource();
			source.buffer = buffer;
			source.connect(audioContext.destination);
			source.start(0);
		});
	}
	request.send();
}

// 録音開始処理
var captureStart = function() {
	if (cFlag) { // already started.
		return;
	}

	cFlag = true;
	console.log('StartInput');

	recorder && recorder.record();
}

// 録音停止処理
var captureStop = function() {
	if (!cFlag) { // already stopped.
		return;
	}

	console.log('EndInput');
	cFlag = false;
	recorder && recorder.stop();
	recorder && recorder.exportWAV(wavExported);

}

function step1() {
	// Get audio/video stream
	navigator.getUserMedia({
		audio : true,
		video : true
	}, function(stream) {
		// Set your video displays
		$('#my-video').prop('src', URL.createObjectURL(stream));
		window.localStream = stream;

		// 録音用にローパスフィルターを通す
		// フィルター通した音声データをリアルタイム送信することは現状だめっぽい？
		audioContext = new AudioContext;
		lowpassFilter = audioContext.createBiquadFilter();
		lowpassFilter.type = 0;
		lowpassFilter.frequency.value = 20000;

		var input = audioContext.createMediaStreamSource(stream);
		input.connect(lowpassFilter);

		recorder = new Recorder(lowpassFilter, {
			workerPath : 'js/recorderjs/recorderWorker.js'
		});

		step2();
	}, function() {
		$('#step1-error').show();
	});
}

function step2() {
	// 通話中の表示を隠す
	$('#step1, #step3').hide();

	// 切ったあとの説明文の表示
	$('#step2').show();
}

function step3(call) {
	// Hang up on an existing call if present
	if (window.existingCall) {
		window.existingCall.close();
	}

	// Wait for stream on the call, then set peer video display
	// their-video(相手の動画を表示するエリア)のプロパティであるsrcをURL.createObjectURL(stream)に設定し、受信した映像データを実際に映す。
	call.on('stream', function(stream) {
		$('#their-video').prop('src', URL.createObjectURL(stream));
	});

	// UI stuff
	window.existingCall = call;
	$('#their-id').text(call.peer);

	// Peerコネクション切断時に発生
	call.on('close', step2);

	// 切断後の表示非表示処理
	$('#step1, #step2').hide();
	$('#step3').show();
}