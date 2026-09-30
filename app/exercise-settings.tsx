import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { EXERCISE_CATEGORIES, addExerciseDefinition, deleteExerciseDefinition, listExerciseDefinitions, type ExerciseCategory, type ExerciseDefinition } from '../src/data/exerciseRepository';

export default function ExerciseSettingsScreen(){
 const db=useSQLiteContext(); const router=useRouter();
 const [category,setCategory]=useState<ExerciseCategory>('가슴'); const [name,setName]=useState(''); const [items,setItems]=useState<ExerciseDefinition[]>([]);
 const load=useCallback(async()=>setItems(await listExerciseDefinitions(db)),[db]);
 useEffect(()=>{void load()},[load]);
 const add=async()=>{if(!name.trim())return;await addExerciseDefinition(db,category,name);setName('');await load()};
 const remove=(item:ExerciseDefinition)=>Alert.alert('운동 삭제',item.name+'을(를) 운동 목록에서 삭제할까요?',[{text:'취소',style:'cancel'},{text:'삭제',style:'destructive',onPress:()=>void(async()=>{await deleteExerciseDefinition(db,item.id);await load()})()}]);
 return <SafeAreaView style={s.safe}><View style={s.header}><Pressable onPress={()=>router.back()}><Text style={s.back}>‹</Text></Pressable><Text style={s.title}>운동 설정</Text><View style={{width:34}}/></View>
 <ScrollView contentContainerStyle={s.content}><Text style={s.desc}>자주 쓰는 운동을 부위별로 저장해두세요. 운동일지에서는 저장 운동 선택과 직접 입력을 모두 사용할 수 있어요.</Text>
 <View style={s.tabs}>{EXERCISE_CATEGORIES.map(x=><Pressable key={x} style={[s.tab,category===x&&s.tabOn]} onPress={()=>setCategory(x)}><Text style={[s.tabText,category===x&&s.tabTextOn]}>{x}</Text></Pressable>)}</View>
 <View style={s.addRow}><TextInput value={name} onChangeText={setName} onSubmitEditing={()=>void add()} placeholder={category+' 운동명 입력'} style={s.input}/><Pressable style={s.add} onPress={()=>void add()}><Text style={s.addText}>추가</Text></Pressable></View>
 <View style={s.card}>{items.filter(x=>x.category===category).length===0?<Text style={s.empty}>아직 등록된 운동이 없어요.</Text>:items.filter(x=>x.category===category).map(x=><View key={x.id} style={s.row}><Text style={s.name}>{x.name}</Text><Pressable onPress={()=>remove(x)}><Text style={s.del}>삭제</Text></Pressable></View>)}</View>
 </ScrollView></SafeAreaView>
}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:'#F6F7F9'},header:{height:60,paddingHorizontal:16,flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:'#FFF'},back:{fontSize:34,color:'#30343B'},title:{fontSize:18,fontWeight:'900',color:'#20242B'},content:{padding:16,gap:14},desc:{fontSize:12,lineHeight:18,color:'#707783'},tabs:{flexDirection:'row',gap:7},tab:{flex:1,height:40,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:'#ECEFF3'},tabOn:{backgroundColor:'#4B68FF'},tabText:{fontSize:12,fontWeight:'900',color:'#6F7783'},tabTextOn:{color:'#FFF'},addRow:{flexDirection:'row',gap:8},input:{flex:1,height:48,paddingHorizontal:14,borderRadius:13,backgroundColor:'#FFF',fontSize:14,color:'#222'},add:{width:70,borderRadius:13,alignItems:'center',justifyContent:'center',backgroundColor:'#252A32'},addText:{fontSize:13,fontWeight:'900',color:'#FFF'},card:{padding:10,borderRadius:16,backgroundColor:'#FFF'},empty:{padding:18,textAlign:'center',color:'#9299A4'},row:{minHeight:52,paddingHorizontal:10,flexDirection:'row',alignItems:'center',borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#E6E8EC'},name:{flex:1,fontSize:14,fontWeight:'800',color:'#30353D'},del:{fontSize:11,fontWeight:'900',color:'#D64B5B'}});
