import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useRef, useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { detectOnImage } from 'react-native-pose-detection';
import { createPostureAssessment, deletePostureAssessment, listPostureAssessments, updatePostureAssessment, type PostureAssessment } from '../src/data/postureRepository';
import { toLocalDateString } from '../src/lib/date';

type Shot = 'front' | 'side' | 'back';
const labels: Record<Shot,string> = { front:'정면', side:'측면', back:'후면' };
type PosePoint = { x:number; y:number; visibility:number };
const DISPLAY_JOINTS=[0,11,12,13,14,15,16,23,24,25,26,27,28,29,30,31,32];
function point(frame: { landmarks: Float32Array }, index:number): PosePoint {
  const offset=index*4; return {x:frame.landmarks[offset],y:frame.landmarks[offset+1],visibility:frame.landmarks[offset+3]};
}
function poseCenterScore(frame: { landmarks: Float32Array }) {
  const joints=[11,12,23,24,25,26,27,28].map(i=>point(frame,i)).filter(p=>p.visibility>=0.35);
  if(!joints.length)return Number.POSITIVE_INFINITY;
  const cx=joints.reduce((sum,p)=>sum+p.x,0)/joints.length;
  const cy=joints.reduce((sum,p)=>sum+p.y,0)/joints.length;
  const centerDistance=Math.hypot(cx-0.5,cy-0.52);
  const visiblePenalty=(8-joints.length)*0.08;
  const outsidePenalty=joints.filter(p=>p.x<0.18||p.x>0.82||p.y<0.05||p.y>0.98).length*0.12;
  return centerDistance+visiblePenalty+outsidePenalty;
}
function chooseGuidePose(frames: Array<{ landmarks: Float32Array }>) {
  return [...frames].sort((a,b)=>poseCenterScore(a)-poseCenterScore(b))[0];
}
function postureFeedback(frame: { landmarks: Float32Array }, shot: Shot) {
  const ls=point(frame,11),rs=point(frame,12),lh=point(frame,23),rh=point(frame,24),nose=point(frame,0);
  const le=point(frame,7),re=point(frame,8),la=point(frame,27),ra=point(frame,28);
  const visible=(...ps:PosePoint[])=>ps.every(p=>p.visibility>=0.35);
  const angleDeg=(a:PosePoint,b:PosePoint)=>Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI;
  const signedHorizontal=(a:PosePoint,b:PosePoint)=>angleDeg(a,b);
  const bodyScale=Math.max(Math.abs(((lh.y+rh.y)/2)-((ls.y+rs.y)/2)),0.12);
  const lines:string[]=[];

  if(shot==='front'||shot==='back'){
    if(visible(ls,rs)){
      const deg=signedHorizontal(ls,rs);
      const diff=Math.abs(rs.y-ls.y)/bodyScale*100;
      if(Math.abs(deg)>=0.8||diff>=1.0) lines.push(`어깨선 기울기 약 ${Math.abs(deg).toFixed(1)}° · 몸통 기준 높이 차이 ${diff.toFixed(1)}%가 관찰됩니다. ${deg>0?'사진 오른쪽 어깨가 더 낮게':'사진 왼쪽 어깨가 더 낮게'} 보입니다.`);
      else lines.push(`어깨선 기울기 약 ${Math.abs(deg).toFixed(1)}°로 큰 좌우 차이는 관찰되지 않습니다.`);
    } else lines.push('어깨 기준점 신뢰도가 낮아 어깨선 판정을 보류합니다. 다시 촬영해 주세요.');

    if(visible(lh,rh)){
      const deg=signedHorizontal(lh,rh);
      const diff=Math.abs(rh.y-lh.y)/bodyScale*100;
      if(Math.abs(deg)>=0.8||diff>=1.0) lines.push(`골반선 기울기 약 ${Math.abs(deg).toFixed(1)}° · 몸통 기준 높이 차이 ${diff.toFixed(1)}%가 관찰됩니다. 한쪽 체중 지지와 촬영 정렬도 함께 확인하세요.`);
      else lines.push(`골반선 기울기 약 ${Math.abs(deg).toFixed(1)}°로 큰 좌우 차이는 관찰되지 않습니다.`);
    } else lines.push('골반 기준점 신뢰도가 낮아 골반선 판정을 보류합니다. 다시 촬영해 주세요.');

    if(visible(nose,ls,rs)){
      const shoulderMidX=(ls.x+rs.x)/2;
      const offset=(nose.x-shoulderMidX)/bodyScale*100;
      if(Math.abs(offset)>=2) lines.push(`머리 중심이 어깨 중심에서 몸통 기준 약 ${Math.abs(offset).toFixed(1)}% 좌우로 벗어나 보입니다.`);
    }
  } else {
    const shoulder=ls.visibility>=rs.visibility?ls:rs;
    const ear=le.visibility>=re.visibility?le:re;
    const ankle=la.visibility>=ra.visibility?la:ra;
    if(visible(ear,shoulder)){
      const dx=(ear.x-shoulder.x)/bodyScale*100;
      lines.push(`측면 머리-어깨 수평 차이: 몸통 기준 ${Math.abs(dx).toFixed(1)}%. ${Math.abs(dx)>=8?'머리가 어깨보다 앞쪽으로 나온 경향을 확인하세요.':'큰 전방 편위는 두드러지지 않습니다.'}`);
    }
    if(visible(ear,shoulder,lh,rh,ankle)){
      const hip={...lh,x:(lh.x+rh.x)/2,y:(lh.y+rh.y)/2,visibility:Math.min(lh.visibility,rh.visibility)};
      const trunkAngle=Math.abs(90-Math.abs(angleDeg(shoulder,hip)));
      lines.push(`상체 수직선 편위 약 ${trunkAngle.toFixed(1)}°가 관찰됩니다. 측면 촬영 각도와 몸통 정렬을 함께 확인하세요.`);
    }
  }
  lines.push('수치는 사진 속 포즈 기준의 코칭 참고값이며 의료 진단이 아닙니다. 같은 거리·높이·가이드 위치로 재촬영해야 전후 비교가 의미 있습니다.');
  return lines.join('\n');
}
type PostureMetrics = { shoulderDeg?:number; hipDeg?:number; headOffset?:number; forwardHead?:number; trunkDeg?:number };
function metricsFromFrame(frame:{landmarks:Float32Array},shot:Shot):PostureMetrics{
  const ls=point(frame,11),rs=point(frame,12),lh=point(frame,23),rh=point(frame,24),nose=point(frame,0),le=point(frame,7),re=point(frame,8);
  const bodyScale=Math.max(Math.abs(((lh.y+rh.y)/2)-((ls.y+rs.y)/2)),0.12);
  const angle=(a:PosePoint,b:PosePoint)=>Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI;
  if(shot==='front'||shot==='back') return {shoulderDeg:Math.abs(angle(ls,rs)),hipDeg:Math.abs(angle(lh,rh)),headOffset:Math.abs(nose.x-(ls.x+rs.x)/2)/bodyScale*100};
  const shoulder=ls.visibility>=rs.visibility?ls:rs,ear=le.visibility>=re.visibility?le:re;
  const hip={...lh,x:(lh.x+rh.x)/2,y:(lh.y+rh.y)/2};
  return {forwardHead:Math.abs(ear.x-shoulder.x)/bodyScale*100,trunkDeg:Math.abs(90-Math.abs(angle(shoulder,hip)))};
}
function structuredObservation(frame:{landmarks:Float32Array},shot:Shot){
  const m=metricsFromFrame(frame,shot); const observed:string[]=[]; const suspected:string[]=[]; const tests:string[]=[]; const exercise:string[]=[];
  if(shot==='front'||shot==='back'){
    if((m.shoulderDeg??0)>=0.8){const ls=point(frame,11),rs=point(frame,12);const side=ls.y>rs.y?'왼쪽 어깨가 오른쪽보다 내려가':'오른쪽 어깨가 왼쪽보다 내려가';observed.push(`${side} 있으며, 어깨선 기울기는 약 ${m.shoulderDeg!.toFixed(1)}°입니다.`);suspected.push('견갑대 좌우 비대칭 또는 한쪽 상부승모근/견갑거근 과긴장 패턴 가능성');tests.push('벽 기대 선 자세에서 좌우 어깨 높이 재확인, 견갑 상방회전·외전/내전 좌우 비교');exercise.push('흉추 신전·회전 가동성, 전거근 활성화, 하부승모근 Y-레이즈를 통증 없는 범위에서 시행');}
    if((m.hipDeg??0)>=0.8){const lh=point(frame,23),rh=point(frame,24);const side=lh.y>rh.y?'왼쪽 골반이 오른쪽보다 내려가':'오른쪽 골반이 왼쪽보다 내려가';observed.push(`${side} 있으며, 골반선 기울기는 약 ${m.hipDeg!.toFixed(1)}°입니다.`);suspected.push('골반 측방경사/한쪽 체중지지 패턴 가능성');tests.push('양발 동일 간격 재촬영, 싱글레그 스탠스와 스텝다운에서 골반 좌우 흔들림 비교');exercise.push('중둔근 활성화, 힙힌지·스텝다운 정렬 연습, 고관절 가동성 운동');}
    if((m.headOffset??0)>=2){const ls=point(frame,11),rs=point(frame,12),nose=point(frame,0);const side=nose.x<(ls.x+rs.x)/2?'왼쪽':'오른쪽';observed.push(`머리 중심이 어깨 중심보다 ${side}으로 치우쳐 있으며, 편위는 몸통 기준 약 ${m.headOffset!.toFixed(1)}%입니다.`);suspected.push('경추-흉추 좌우 정렬 보상 패턴 가능성');tests.push('벽 기대 자세와 목 회전 가동범위를 좌우 비교');exercise.push('턱 당기기, 흉추 회전 운동을 통증 없는 범위에서 시행');}
  } else {
    if((m.forwardHead??0)>=8){observed.push(`머리-어깨 전방 편위 약 ${m.forwardHead!.toFixed(1)}%`);suspected.push('전방머리자세/상부교차 패턴 가능성');tests.push('벽에 뒤통수-등-골반을 편하게 대고 뒤통수 접촉 여부 확인, 목 굴곡·신전 시 증상 확인');exercise.push('턱 당기기, 흉추 신전, 가슴근 스트레칭, 하부승모근·전거근 활성화');}
    if((m.trunkDeg??0)>=2){observed.push(`상체 수직선 편위 약 ${m.trunkDeg!.toFixed(1)}°`);suspected.push('몸통 전후 정렬 보상 패턴 가능성');tests.push('벽 기대 선 자세와 자연 선 자세를 비교하고 골반-흉곽 위치 확인');exercise.push('호흡을 이용한 흉곽-골반 중립 연습, 데드버그·힙힌지 패턴 연습');}
  }
  if(!observed.length) observed.push('현재 사진에서 설정 기준을 넘는 뚜렷한 편위가 검출되지 않았습니다.');
  if(!suspected.length) suspected.push('사진만으로 특정 근골격계 질환을 의심할 근거가 충분하지 않습니다.');
  if(!tests.length) tests.push('같은 촬영 조건으로 재촬영하고 통증·가동범위·좌우 기능 차이를 함께 확인하세요.');
  if(!exercise.length) exercise.push('통증 없는 범위의 전신 가동성·기본 정렬 운동부터 진행하세요.');
  return `[관찰 결과]\n• ${observed.join('\n• ')}\n\n[가능한 관련 패턴]\n• ${suspected.join('\n• ')}\n\n[확인 테스트]\n• ${tests.join('\n• ')}\n\n[교정운동 제안]\n• ${exercise.join('\n• ')}\n\n※ 사진 분석은 진단이 아닙니다. 통증·저림·근력저하가 있거나 테스트에서 증상이 재현되면 의료진 평가를 권장합니다.`;
}


export default function PostureAssessmentScreen() {
  const db=useSQLiteContext(); const params=useLocalSearchParams<{memberId?:string}>(); const memberId=typeof params.memberId==='string'?params.memberId:'';
  const [permission,requestPermission]=useCameraPermissions(); const camera=useRef<CameraView>(null);
  const [items,setItems]=useState<PostureAssessment[]>([]); const [active,setActive]=useState<PostureAssessment|null>(null); const [shot,setShot]=useState<Shot|null>(null); const [feedback,setFeedback]=useState('');
  const [posePoints,setPosePoints]=useState<PosePoint[]>([]); const [analyzing,setAnalyzing]=useState(false); const [analyzedPhoto,setAnalyzedPhoto]=useState<string|null>(null); const [photoRatio,setPhotoRatio]=useState(3/4);
  const [compareBaseId,setCompareBaseId]=useState<string|null>(null); const [compareCurrentId,setCompareCurrentId]=useState<string|null>(null); const [compareText,setCompareText]=useState(''); const [comparing,setComparing]=useState(false);
  const load=useCallback(async()=>{if(memberId)setItems(await listPostureAssessments(db,memberId));},[db,memberId]);
  useFocusEffect(useCallback(()=>{void load();},[load]));
  const start=async()=>{const list=await listPostureAssessments(db,memberId);const unfinished=list.find(x=>!x.frontPhotoUri&&!x.sidePhotoUri&&!x.backPhotoUri&&!x.coachFeedback);if(unfinished){setActive(unfinished);setFeedback('');setAnalyzedPhoto(null);setPosePoints([]);return;}const id=await createPostureAssessment(db,memberId,toLocalDateString(new Date()));const next=await listPostureAssessments(db,memberId);setItems(next);setActive(next.find(x=>x.id===id)??null);setFeedback('');setAnalyzedPhoto(null);setPosePoints([]);};
  const photoUri=(item:PostureAssessment,s:Shot)=>s==='front'?item.frontPhotoUri:s==='side'?item.sidePhotoUri:item.backPhotoUri;
  const openCamera=async(s:Shot)=>{if(!permission?.granted){const r=await requestPermission();if(!r.granted){Alert.alert('카메라 권한이 필요해요.');return;}}setShot(s);};
  const analyzePhoto=async(uri:string,saveAuto=false)=>{
    setAnalyzedPhoto(uri); setPosePoints([]); setAnalyzing(true);
    Image.getSize(uri,(w,h)=>{if(w>0&&h>0)setPhotoRatio(w/h);},()=>setPhotoRatio(3/4));
    try{
      const poses=await detectOnImage(uri,{maxPoses:4,angles:true}); const frame=chooseGuidePose(poses);
      if(frame){
        const points=DISPLAY_JOINTS.map(i=>point(frame,i)).filter(p=>p.visibility>=0.45); setPosePoints(points);
        const auto=structuredObservation(frame, shot ?? 'front');
        if(saveAuto&&active){setFeedback(auto);await updatePostureAssessment(db,active.id,{coachFeedback:auto});}
      }else Alert.alert('자세를 찾지 못했어요.','분석할 사람 한 명이 가운데 가이드 안에 크게 들어오도록 다시 촬영해 주세요.');
    }catch(error){console.error(error);Alert.alert('자동 분석 실패','사진은 저장됐지만 관절점 분석에 실패했어요. 다시 촬영해 주세요.');}
    finally{setAnalyzing(false);}
  };
  const compareAssessments=async()=>{const base=items.find(x=>x.id===compareBaseId),current=items.find(x=>x.id===compareCurrentId);if(!base||!current){Alert.alert('비교 날짜를 선택해 주세요.','이전 기록과 현재 기록을 각각 선택해 주세요.');return;}if(base.id===current.id){Alert.alert('서로 다른 날짜를 선택해 주세요.');return;}try{setComparing(true);const analyze=async(item:PostureAssessment)=>{const result:PostureMetrics={};for(const [shot,uri] of [['front',item.frontPhotoUri],['side',item.sidePhotoUri]] as Array<[Shot,string|null]>){if(!uri)continue;const poses=await detectOnImage(uri,{maxPoses:4,angles:true});const frame=chooseGuidePose(poses);if(frame)Object.assign(result,metricsFromFrame(frame,shot));}return result;};const a=await analyze(base),b=await analyze(current);const lines=[`${base.assessedDate} → ${current.assessedDate} 비교`];const add=(label:string,x?:number,y?:number,unit='°')=>{if(x===undefined||y===undefined)return;const d=y-x;lines.push(`${label}: ${x.toFixed(1)}${unit} → ${y.toFixed(1)}${unit} (${Math.abs(d).toFixed(1)}${unit} ${d<0?'개선':'증가'})`);};add('어깨선 기울기',a.shoulderDeg,b.shoulderDeg);add('골반선 기울기',a.hipDeg,b.hipDeg);add('머리 좌우 편위',a.headOffset,b.headOffset,'%');add('머리 전방 편위',a.forwardHead,b.forwardHead,'%');add('상체 수직선 편위',a.trunkDeg,b.trunkDeg);lines.push('※ 동일한 거리·카메라 높이·가이드 위치로 촬영한 사진끼리 비교할 때 가장 의미가 있습니다.');setCompareText(lines.join('\n'));}catch(e){console.error(e);Alert.alert('비교 분석 실패','두 기록의 사진을 분석하지 못했어요.');}finally{setComparing(false);}};
  const viewShot=(s:Shot)=>{if(!active)return;const uri=photoUri(active,s);if(uri)void analyzePhoto(uri,false);else void openCamera(s);};
  const capture=async()=>{if(!shot||!active)return;const photo=await camera.current?.takePictureAsync({quality:0.85});if(!photo?.uri)return;const key=shot==='front'?'frontPhotoUri':shot==='side'?'sidePhotoUri':'backPhotoUri';await updatePostureAssessment(db,active.id,{[key]:photo.uri});setShot(null);await analyzePhoto(photo.uri,true);const list=await listPostureAssessments(db,memberId);setItems(list);setActive(list.find(x=>x.id===active.id)??null);};
  const removeActive=()=>{if(!active)return;Alert.alert('분석 기록 삭제','이번 체형 분석 기록을 삭제할까요?',[{text:'취소',style:'cancel'},{text:'삭제',style:'destructive',onPress:()=>void(async()=>{await deletePostureAssessment(db,active.id);setActive(null);setFeedback('');setAnalyzedPhoto(null);setPosePoints([]);setAnalyzing(false);setPhotoRatio(3/4);await load();})()}]);};
  const saveFeedback=async()=>{if(!active)return;await updatePostureAssessment(db,active.id,{coachFeedback:feedback});await load();Alert.alert('저장 완료','체형 관찰 메모를 저장했어요.');};
  return <SafeAreaView style={s.safe}><View style={s.header}><Pressable onPress={()=>router.back()}><Text style={s.back}>‹ 뒤로</Text></Pressable><Text style={s.title}>체형 분석</Text><View style={{width:60}}/></View>
    <ScrollView contentContainerStyle={s.content}>
      <View style={s.notice}><Text style={s.noticeTitle}>트레이너용 자세 관찰 보조</Text><Text style={s.noticeText}>정면·측면·후면을 같은 거리와 카메라 높이에서 촬영해 변화를 비교하세요. 이 기능은 의료 진단이 아니며 통증·신경학적 증상은 의료진 평가가 우선입니다.</Text></View>
      <Pressable style={s.start} onPress={()=>void start()}><Text style={s.startText}>+ 새 체형 분석 시작</Text></Pressable>
      {active?<View style={s.assessment}><Text style={s.assessmentTitle}>{active.assessedDate} 촬영</Text><View style={s.shots}>{(['front','side','back'] as Shot[]).map(x=>{const uri=photoUri(active,x);return <View key={x} style={[s.shot,uri&&s.shotDone]}><Pressable style={s.shotView} onPress={()=>viewShot(x)}><Text style={s.shotLabel}>{labels[x]}</Text><Text style={s.shotState}>{uri?'사진 보기':'촬영하기'}</Text></Pressable>{uri?<Pressable style={s.retake} onPress={()=>void openCamera(x)}><Text style={s.retakeText}>다시 촬영</Text></Pressable>:null}</View>})}</View>
        {analyzedPhoto ? <View style={s.previewWrap}><View style={[s.photoStage,{aspectRatio:photoRatio}]}><Image source={{uri:analyzedPhoto}} style={StyleSheet.absoluteFill} resizeMode="stretch"/><View pointerEvents="none" style={StyleSheet.absoluteFill}>{posePoints.map((p,i)=><View key={i} style={[s.point,{left:`${Math.max(0,Math.min(100,p.x*100))}%`,top:`${Math.max(0,Math.min(100,p.y*100))}%`}]} />)}</View></View><Text style={s.previewCaption}>{analyzing?'관절점을 분석하고 있어요...':`자동 검출된 관절점 ${posePoints.length}개 · 사진 좌표에 맞춰 표시됩니다.`}</Text></View>:null}
        <TextInput value={feedback} onChangeText={setFeedback} multiline placeholder="관찰 메모 예: 좌우 어깨 높이 차이 관찰, 스쿼트 시 추가 확인..." style={s.memo}/><View style={s.saveRow}><Pressable style={s.save} onPress={()=>void saveFeedback()}><Text style={s.saveText}>관찰 메모 저장</Text></Pressable><Pressable style={s.deleteAssessment} onPress={removeActive}><Text style={s.deleteAssessmentText}>이번 기록 삭제</Text></Pressable></View>
      </View>:null}
      <Text style={s.section}>체형 변화 비교</Text><View style={s.compareCard}><Text style={s.compareGuide}>비교할 두 날짜를 선택하세요.</Text><Text style={s.compareLabel}>이전</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.dateChips}>{items.map(x=><Pressable key={'base-'+x.id} style={[s.dateChip,compareBaseId===x.id&&s.dateChipActive]} onPress={()=>setCompareBaseId(x.id)}><Text style={[s.dateChipText,compareBaseId===x.id&&s.dateChipTextActive]}>{x.assessedDate}</Text></Pressable>)}</ScrollView><Text style={s.compareLabel}>현재</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.dateChips}>{items.map(x=><Pressable key={'current-'+x.id} style={[s.dateChip,compareCurrentId===x.id&&s.dateChipActive]} onPress={()=>setCompareCurrentId(x.id)}><Text style={[s.dateChipText,compareCurrentId===x.id&&s.dateChipTextActive]}>{x.assessedDate}</Text></Pressable>)}</ScrollView><Pressable style={s.compareButton} onPress={()=>void compareAssessments()} disabled={comparing}><Text style={s.compareButtonText}>{comparing?'비교 분석 중...':'선택 날짜 비교 분석'}</Text></Pressable>{compareText?<Text style={s.compareResult}>{compareText}</Text>:null}</View>
      <Text style={s.section}>이전 분석 기록</Text>{items.map(x=><View key={x.id} style={s.history}><Pressable style={s.historyOpen} onPress={()=>{setActive(x);setFeedback(x.coachFeedback??'');setAnalyzedPhoto(null);setPosePoints([]);}}><View><Text style={s.historyDate}>{x.assessedDate}</Text><Text style={s.historyMeta}>{[x.frontPhotoUri,x.sidePhotoUri,x.backPhotoUri].filter(Boolean).length}/3 방향 촬영 · {x.coachFeedback?'메모 있음':'메모 없음'}</Text></View><Text style={s.arrow}>›</Text></Pressable><Pressable style={s.historyDelete} onPress={()=>Alert.alert('이전 분석 기록 삭제',`${x.assessedDate} 체형 분석 기록을 삭제할까요?`,[{text:'취소',style:'cancel'},{text:'삭제',style:'destructive',onPress:()=>void(async()=>{await deletePostureAssessment(db,x.id);if(active?.id===x.id){setActive(null);setFeedback('');setAnalyzedPhoto(null);setPosePoints([]);setAnalyzing(false);}await load();})()}])}><Text style={s.historyDeleteText}>삭제</Text></Pressable></View>)}
    </ScrollView>
    <Modal visible={shot!==null} animationType="slide" onRequestClose={()=>setShot(null)}><View style={s.cameraWrap}><CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back"/><SafeAreaView style={s.cameraUi}><Text style={s.cameraTitle}>{shot?labels[shot]:''} 촬영</Text><View style={s.guide}><View style={s.sideLeft}><Text style={s.sideMark}>왼쪽</Text></View><View style={s.sideRight}><Text style={s.sideMark}>오른쪽</Text></View><View style={s.noseTarget}><View style={s.noseDot}/><Text style={s.targetLabel}>코 맞춤점</Text></View><View style={s.centerLine}/><View style={s.footBox}><Text style={s.footBoxText}>발 위치</Text></View></View><Text style={s.cameraHelp}>{shot==='side'?'코를 점에 맞추고 몸 전체를 중앙선 안에 세워주세요':'코를 점에 맞추고 양발을 아래 발 위치에 맞춰주세요'}</Text><View style={s.cameraButtons}><Pressable style={s.cancel} onPress={()=>setShot(null)}><Text style={s.cancelText}>취소</Text></Pressable><Pressable style={s.capture} onPress={()=>void capture()}><View style={s.captureInner}/></Pressable><View style={{width:64}}/></View></SafeAreaView></View></Modal>
  </SafeAreaView>;
}
const s=StyleSheet.create({
 safe:{flex:1,backgroundColor:'#F5F6F8'},header:{height:60,paddingHorizontal:18,flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:'#FFF'},back:{width:60,fontSize:15,fontWeight:'800',color:'#4B68FF'},title:{fontSize:18,fontWeight:'900',color:'#252A32'},content:{padding:16,paddingBottom:50},notice:{padding:15,borderRadius:15,backgroundColor:'#FFF8E8'},noticeTitle:{fontSize:14,fontWeight:'900',color:'#5E4A1D'},noticeText:{marginTop:6,fontSize:11,lineHeight:17,color:'#776637'},start:{marginTop:12,minHeight:52,borderRadius:14,alignItems:'center',justifyContent:'center',backgroundColor:'#4B68FF'},startText:{fontSize:14,fontWeight:'900',color:'#FFF'},assessment:{marginTop:12,padding:15,borderRadius:16,backgroundColor:'#FFF'},assessmentTitle:{fontSize:16,fontWeight:'900',color:'#252A32'},shots:{flexDirection:'row',gap:8,marginTop:12},shot:{flex:1,minHeight:92,padding:10,borderRadius:12,justifyContent:'center',backgroundColor:'#F1F3F6'},shotDone:{backgroundColor:'#E9F7EF'},shotView:{flex:1,justifyContent:'center'},shotLabel:{fontSize:14,fontWeight:'900',color:'#303640'},shotState:{marginTop:6,fontSize:10,fontWeight:'800',color:'#4B68FF'},retake:{marginTop:6,alignSelf:'flex-start',paddingVertical:4,paddingHorizontal:7,borderRadius:7,backgroundColor:'#FFF'},retakeText:{fontSize:9,fontWeight:'800',color:'#737B87'},memo:{minHeight:90,marginTop:12,padding:12,borderRadius:12,textAlignVertical:'top',backgroundColor:'#F3F5F8',fontSize:12,color:'#252A32'},save:{minHeight:45,marginTop:9,borderRadius:11,alignItems:'center',justifyContent:'center',backgroundColor:'#E8EDFF'},saveText:{fontSize:12,fontWeight:'900',color:'#4B68FF'},section:{marginTop:22,marginBottom:8,fontSize:16,fontWeight:'900',color:'#252A32'},compareCard:{padding:14,borderRadius:16,backgroundColor:'#FFF'},compareGuide:{fontSize:11,color:'#747C88'},compareLabel:{marginTop:10,marginBottom:5,fontSize:10,fontWeight:'900',color:'#555D68'},dateChips:{gap:6,paddingRight:8},dateChip:{paddingHorizontal:10,paddingVertical:7,borderRadius:9,backgroundColor:'#F1F3F6'},dateChipActive:{backgroundColor:'#4B68FF'},dateChipText:{fontSize:10,fontWeight:'800',color:'#68707C'},dateChipTextActive:{color:'#FFF'},compareButton:{minHeight:42,marginTop:12,borderRadius:11,alignItems:'center',justifyContent:'center',backgroundColor:'#E8EDFF'},compareButtonText:{fontSize:11,fontWeight:'900',color:'#4B68FF'},compareResult:{marginTop:10,padding:11,borderRadius:10,fontSize:11,lineHeight:18,color:'#3E4650',backgroundColor:'#F7F8FA'},history:{minHeight:66,marginBottom:7,borderRadius:14,flexDirection:'row',alignItems:'stretch',backgroundColor:'#FFF',overflow:'hidden'},historyOpen:{flex:1,padding:13,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},historyDelete:{width:58,alignItems:'center',justifyContent:'center',backgroundColor:'#FFF0F1'},historyDeleteText:{fontSize:11,fontWeight:'900',color:'#D64B5B'},historyDate:{fontSize:14,fontWeight:'900',color:'#303640'},historyMeta:{marginTop:4,fontSize:10,color:'#7D8490'},arrow:{fontSize:24,color:'#9AA1AC'},cameraWrap:{flex:1,backgroundColor:'#000'},cameraUi:{flex:1,alignItems:'center',justifyContent:'space-between',paddingVertical:18},cameraTitle:{fontSize:18,fontWeight:'900',color:'#FFF'},guide:{width:'55%',height:'68%',borderWidth:2,borderColor:'rgba(255,255,255,0.78)',borderRadius:24,alignItems:'center'},noseTarget:{position:'absolute',top:'9%',alignItems:'center',zIndex:2},noseDot:{width:20,height:20,borderRadius:10,borderWidth:3,borderColor:'#FFF',backgroundColor:'rgba(75,104,255,0.82)'},sideLeft:{position:'absolute',left:8,top:'48%',zIndex:3},sideRight:{position:'absolute',right:8,top:'48%',zIndex:3},sideMark:{fontSize:10,fontWeight:'900',color:'#FFF',backgroundColor:'rgba(0,0,0,0.58)',paddingHorizontal:6,paddingVertical:4,borderRadius:6},targetLabel:{marginTop:4,paddingHorizontal:7,paddingVertical:3,borderRadius:6,fontSize:9,fontWeight:'900',color:'#FFF',backgroundColor:'rgba(0,0,0,0.55)'},centerLine:{position:'absolute',top:'9%',bottom:'9%',width:1,borderLeftWidth:1,borderStyle:'dashed',borderColor:'rgba(255,255,255,0.72)'},footBox:{position:'absolute',bottom:'3%',width:'58%',height:30,borderWidth:1.5,borderStyle:'dashed',borderColor:'rgba(255,255,255,0.82)',borderRadius:8,alignItems:'center',justifyContent:'center'},footBoxText:{fontSize:9,fontWeight:'900',color:'#FFF',backgroundColor:'rgba(0,0,0,0.45)',paddingHorizontal:5,paddingVertical:2,borderRadius:5},cameraHelp:{fontSize:12,fontWeight:'800',color:'#FFF'},cameraButtons:{width:'100%',paddingHorizontal:30,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},cancel:{width:64,height:44,alignItems:'center',justifyContent:'center'},cancelText:{fontSize:14,fontWeight:'900',color:'#FFF'},capture:{width:74,height:74,borderRadius:37,borderWidth:4,borderColor:'#FFF',alignItems:'center',justifyContent:'center'},captureInner:{width:56,height:56,borderRadius:28,backgroundColor:'#FFF'},
 saveRow:{flexDirection:'row',gap:8},deleteAssessment:{minHeight:45,marginTop:9,paddingHorizontal:14,borderRadius:11,alignItems:'center',justifyContent:'center',backgroundColor:'#FFF0F1'},deleteAssessmentText:{fontSize:11,fontWeight:'900',color:'#D64B5B'},previewWrap:{marginTop:12,borderRadius:14,overflow:'hidden',backgroundColor:'#111',alignItems:'center'},photoStage:{width:'100%',maxWidth:520,position:'relative',backgroundColor:'#111'},point:{position:'absolute',width:12,height:12,marginLeft:-6,marginTop:-6,borderRadius:6,borderWidth:2,borderColor:'#FFF',backgroundColor:'#4B68FF'},analysisLine:{position:'absolute',height:2,backgroundColor:'#7CFFB2'},previewCaption:{padding:9,fontSize:9,lineHeight:14,color:'#FFF'},analysisLineDummy:{height:0},});
