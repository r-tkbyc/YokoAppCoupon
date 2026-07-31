// 日時入力の回帰テスト
//   exp: [year, month, day, hour, minute]  hour=null は「時刻なし（既定値が入る）」
//        null は「読めなくて当然（NGが正解）」
//   warn: true を指定すると「時刻が読めず既定値を使用」の警告が立つことも検証する
(function(){
  var LF = String.fromCharCode(10);
  var out = [], fails = 0;
  function log(s){ out.push(s); }
  function flush(){ var p=document.getElementById('testout'); if(p) p.textContent=out.join(LF); }
  window.addEventListener('error', function(ev){ log('!! ERR ' + ev.message); flush(); });

  var BY = '2026', Y = 2026;

  var CORPUS = [
    ['9/6(日)10：00',                [Y,9,6,10,0],   '実例'],   // 締め括弧の後にスペースが無い
    ['8/15 17:00',                  [Y,8,15,17,0],  '実例'],
    ['2026/8/15 17時',              [Y,8,15,17,0],  '実例'],
    ['2026年8月15日（土）17:00',      [Y,8,15,17,0],  '実例'],

    ['8/15',       [Y,8,15,null,null], '日付'],
    ['08/15',      [Y,8,15,null,null], '日付'],
    ['8/5',        [Y,8,5,null,null],  '日付'],
    ['12/31',      [Y,12,31,null,null],'日付'],
    ['2026/8/15',  [Y,8,15,null,null], '日付'],
    ['2026/08/15', [Y,8,15,null,null], '日付'],
    ['2026-8-15',  [Y,8,15,null,null], '日付'],
    ['2026-08-15', [Y,8,15,null,null], '日付'],
    ['2026.8.15',  [Y,8,15,null,null], '日付'],
    ['8-15',       [Y,8,15,null,null], '日付'],
    ['8.15',       [Y,8,15,null,null], '日付'],
    ['8 / 15',     [Y,8,15,null,null], '日付'],
    ['8／15',      [Y,8,15,null,null], '日付'],
    ['8月15日',       [Y,8,15,null,null], '日付'],
    ['2026年8月15日', [Y,8,15,null,null], '日付'],
    ['8月15',         [Y,8,15,null,null], '日付'],
    ['8月 15日',      [Y,8,15,null,null], '日付'],
    ['８／１５',          [Y,8,15,null,null], '日付'],
    ['８月１５日',        [Y,8,15,null,null], '日付'],
    ['２０２６年８月１５日', [Y,8,15,null,null], '日付'],
    ['２０２６/８/１５',    [Y,8,15,null,null], '日付'],

    ['8/15(土)',            [Y,8,15,null,null], '曜日'],
    ['8/15（土）',           [Y,8,15,null,null], '曜日'],
    ['8/15 (土)',           [Y,8,15,null,null], '曜日'],
    ['8/15土',              [Y,8,15,null,null], '曜日'],
    ['8/15 土',             [Y,8,15,null,null], '曜日'],
    ['8月15日(土)',          [Y,8,15,null,null], '曜日'],
    ['2026年8月15日(土)',    [Y,8,15,null,null], '曜日'],
    ['8/15[土]',            [Y,8,15,null,null], '曜日'],
    ['8/15・土',            [Y,8,15,null,null], '曜日'],

    ['8/15 17:00',   [Y,8,15,17,0],  '時刻'],
    ['8/15 17：00',  [Y,8,15,17,0],  '時刻'],
    ['8/15　17:00',  [Y,8,15,17,0],  '時刻'],
    ['8/15 9:00',    [Y,8,15,9,0],   '時刻'],
    ['8/15 09:00',   [Y,8,15,9,0],   '時刻'],
    ['8/15 17:30',   [Y,8,15,17,30], '時刻'],
    ['8/15 17:00:00',[Y,8,15,17,0],  '時刻'],
    ['8/15 17:0',    [Y,8,15,17,0],  '時刻'],
    ['8/15 17.00',   [Y,8,15,17,0],  '時刻'],
    ['8/15 17-00',   [Y,8,15,17,0],  '時刻'],

    ['8/15 17時',       [Y,8,15,17,0],  '和文時刻'],
    ['8/15 17時00分',   [Y,8,15,17,0],  '和文時刻'],
    ['8/15 17時30分',   [Y,8,15,17,30], '和文時刻'],
    ['8/15 17時半',     [Y,8,15,17,30], '和文時刻'],
    ['8/15 １７時',      [Y,8,15,17,0],  '和文時刻'],
    ['8月15日17時',      [Y,8,15,17,0],  '和文時刻'],

    ['8/15 午前10時',    [Y,8,15,10,0],  '午前午後'],
    ['8/15 午後5時',     [Y,8,15,17,0],  '午前午後'],
    ['8/15 午後5:00',    [Y,8,15,17,0],  '午前午後'],
    ['8/15 午後5時30分', [Y,8,15,17,30], '午前午後'],
    ['8/15 PM5:00',     [Y,8,15,17,0],  '午前午後'],
    ['8/15 pm5:00',     [Y,8,15,17,0],  '午前午後'],
    ['8/15 5:00PM',     [Y,8,15,17,0],  '午前午後'],
    ['8/15 AM10:00',    [Y,8,15,10,0],  '午前午後'],
    ['8/15 午後12時',    [Y,8,15,12,0],  '午前午後'],
    ['8/15 午前0時',     [Y,8,15,0,0],   '午前午後'],

    ['8/15 17:00～',      [Y,8,15,17,0],  '付帯'],
    ['8/15 17:00開始',    [Y,8,15,17,0],  '付帯'],
    ['8/15 17:00より',    [Y,8,15,17,0],  '付帯'],
    ['開始 8/15 17:00',   [Y,8,15,17,0],  '付帯'],
    ['8/15 17:00~20:00',  [Y,8,15,17,0],  '付帯'],
    ['8/15～8/20',        [Y,8,15,null,null], '付帯'],
    ['8/15(土)～8/20(木)', [Y,8,15,null,null], '付帯'],
    ['8/15 17:00 まで',    [Y,8,15,17,0],  '付帯'],
    ['※8/15 17:00',       [Y,8,15,17,0],  '付帯'],

    ['R8/8/15',        [Y,8,15,null,null], '元号'],
    ['令和8年8月15日',   [Y,8,15,null,null], '元号'],
    ['R8.8.15',        [Y,8,15,null,null], '元号'],

    ['',        null, '異常'],
    ['   ',     null, '異常'],
    ['未定',     null, '異常'],
    ['なし',     null, '異常'],
    ['TBD',     null, '異常'],
    ['8/32',    null, '異常'],
    ['13/1',    null, '異常'],
    // 日付は妥当・時刻だけ不正 → 日付は活かし、時刻は既定値＋警告
    ['8/15 25:00', [Y,8,15,null,null], '異常', true]
  ];

  // 警告フラグ（timeUnparsed）の検証。誤警告するとオオカミ少年になるので重要。
  var WARN_CASES = [
    ['8/15',              false, '時刻の記述が無い → 警告しない'],
    ['8/15 17:00',        false, '正しく読めた → 警告しない'],
    ['8/15 17時',         false, '正しく読めた → 警告しない'],
    ['8/15～8/20',        false, '範囲表記に数字があるが時刻ではない → 警告しない'],
    ['8/15(土)～8/20(木)', false, '同上'],
    ['8/15 25:00',        true,  '時刻らしき記述があるのに読めない → 警告する'],
    ['8/15 17:99',        true,  '同上']
  ];

  function actualOf(input){
    var r;
    try { r = parseDateTimeLoose(input, BY); } catch(e){ return { crash: e.message }; }
    if (!r || !r.ok) return { ng: true };
    return { y:r.year, mo:r.month, da:r.day,
             h: r.hasTime ? r.hour : null, mi: r.hasTime ? r.minute : null,
             warn: !!r.timeUnparsed };
  }

  function verdict(exp, wantWarn, act){
    if (act.crash) return ['CRASH', act.crash];
    if (exp === null) return act.ng ? ['OK','NG(正解)'] : ['WRONG','読めてはいけないのに '+act.y+'/'+act.mo+'/'+act.da];
    if (act.ng) return ['NG', '読めない → 出力が空になる'];
    var got = act.y+'/'+act.mo+'/'+act.da + (act.h===null?' 時刻なし':' '+act.h+':'+String(act.mi).padStart(2,'0'));
    var want= exp[0]+'/'+exp[1]+'/'+exp[2] + (exp[3]===null?' 時刻なし':' '+exp[3]+':'+String(exp[4]).padStart(2,'0'));
    if (got !== want) return ['WRONG', '得: '+got+'   ← 期待: '+want];
    if (wantWarn && !act.warn) return ['WRONG', '警告が立つべきなのに立たない'];
    return ['OK', got + (act.warn ? '  (時刻警告あり)' : '')];
  }

  function pad(s,n){ s=String(s); while(s.length<n) s+=' '; return s; }

  try {
    var tally={OK:0,NG:0,WRONG:0,CRASH:0}, byCat={}, problems=[];
    CORPUS.forEach(function(row){
      var v = verdict(row[1], row[3], actualOf(row[0]));
      tally[v[0]]++;
      byCat[row[2]] = byCat[row[2]] || {OK:0,NG:0,WRONG:0,CRASH:0};
      byCat[row[2]][v[0]]++;
      if (v[0] !== 'OK') problems.push([row[2], row[0], v[0], v[1]]);
    });
    var total = CORPUS.length;
    log('=== パース結果（' + total + ' 件 / baseYear=2026） ===');
    log('  OK ' + tally.OK + ' / ' + total + '   NG ' + tally.NG + '   WRONG ' + tally.WRONG + (tally.CRASH?('   CRASH '+tally.CRASH):''));
    log('');
    Object.keys(byCat).forEach(function(c){
      var b=byCat[c], n=b.OK+b.NG+b.WRONG+b.CRASH;
      log('  ' + pad(c,10) + pad(b.OK+'/'+n, 8) + (b.NG?' NG:'+b.NG:'') + (b.WRONG?'  WRONG:'+b.WRONG:''));
    });
    if (problems.length){
      log('');
      log('--- 不一致 ---');
      problems.forEach(function(p){ log('  ' + pad(p[2],6) + pad(JSON.stringify(p[1]),26) + p[3]); });
      fails += problems.length;
    }

    log('');
    log('=== 時刻警告フラグの検証（誤警告しないこと） ===');
    WARN_CASES.forEach(function(w){
      var a = actualOf(w[0]);
      var got = a.ng ? 'NG' : (a.warn ? '警告あり' : '警告なし');
      var want = w[1] ? '警告あり' : '警告なし';
      var ok = (got === want);
      if (!ok) fails++;
      log('  ' + (ok?'OK  ':'★NG ') + pad(JSON.stringify(w[0]),24) + pad(got,10) + w[2]);
    });

    // ---------------- end-to-end ----------------
    var si=document.getElementById('dtStartIn'), ei=document.getElementById('dtEndIn'),
        wi=document.getElementById('dtWishIn'), btn=document.querySelector('.btn-convert'),
        toastEl=document.getElementById('toast');

    function run(s,e,w){
      si.value=s; ei.value=e; wi.value=w||'';
      btn.click();
      return {
        us:document.getElementById('dtUsableStartOut').value,
        ee:document.getElementById('dtEndOutCombined').value,
        ps:document.getElementById('dtPublishStartOut').value,
        hid:document.getElementById('dtUsableEndOut').value,
        toast:(toastEl.textContent||''),
        bad:[si,ei,wi].filter(function(x){return x.classList.contains('dt-bad');})
                      .map(function(x){return x.id;})
      };
    }
    function e2e(title,s,e,w){
      var r=run(s,e,w);
      log('');
      log('■ ' + title);
      log('   開始='+JSON.stringify(s)+' 終了='+JSON.stringify(e)+(w?' 配布希望='+JSON.stringify(w):''));
      log('     利用可能/開始 = ' + JSON.stringify(r.us));
      log('     公開・利用/終了 = ' + JSON.stringify(r.ee));
      log('     公開/開始      = ' + JSON.stringify(r.ps));
      log('     赤枠   = ' + (r.bad.length?r.bad.join(','):'なし'));
      log('     トースト = ' + r.toast);
    }

    log('');
    log('=== 変換ボタン（end-to-end） ===');
    e2e('正常', '2/18', '3/4');
    e2e('ユーザー報告の失敗例', '9/6(日)10：00', '9/20(日)20:00');
    e2e('★終了だけ読めない → 開始は残るか', '2/18', 'あとで');
    e2e('★時刻が不正 → 日付は活かして警告', '2/18 10:00', '3/4 26:00');
    e2e('年跨ぎ（12/28 → 1/5）', '12/28', '1/5');
    e2e('配布希望の前年寄せ（開始1/10・希望12/20）', '1/10', '1/20', '12/20');
    e2e('和文時刻（終了18時が20:00に化けないか）', '2/18 10時', '3/4 18時');

    log('');
    log(fails === 0 ? '>>> 全パス' : '>>> 失敗 ' + fails + ' 件');

  } catch(e){ log('!! EX ' + e.message + LF + e.stack); }
  flush();
})();
