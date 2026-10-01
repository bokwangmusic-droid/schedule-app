import * as MediaLibrary from 'expo-media-library/legacy';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAppSession } from '../src/auth/appSession';
import {
  fetchTrainerProfile,
  saveTrainerProfile,
  uploadTrainerProfilePhoto,
} from '../src/remote/trainerProfile';

type Asset = { id: string; uri: string };

export default function TrainerProfileScreen() {
  const db = useSQLiteContext();
  const [trainerId, setTrainerId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [specialties, setSpecialties] = useState('');
  const [certifications, setCertifications] = useState('');
  const [career, setCareer] = useState('');
  const [education, setEducation] = useState('');
  const [awards, setAwards] = useState('');
  const [instagram, setInstagram] = useState('');
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);

  useEffect(() => {
    let active = true;
    void getAppSession(db)
      .then(async (session) => {
        if (!active) return;
        if (!session || session.role !== 'trainer') {
          router.replace('/login');
          return;
        }

        setTrainerId(session.trainerId);
        setAccessToken(session.accessToken ?? '');

        if (!session.accessToken) {
          setLoading(false);
          return;
        }

        try {
          const profile = await fetchTrainerProfile(session.accessToken, session.trainerId);
          if (!active || !profile) return;
          setName(profile.name ?? '');
          setBio(profile.bio ?? '');
          setSpecialties(profile.specialties ?? '');
          setCertifications(profile.certifications ?? '');
          setCareer(profile.career ?? '');
          setEducation(profile.education ?? '');
          setAwards(profile.awards ?? '');
          setInstagram(profile.instagram ?? '');
          setPhotoUri(profile.profile_photo_url ?? null);
        } catch (error) {
          console.error(error);
          Alert.alert(
            '프로필 불러오기 실패',
            error instanceof Error ? error.message : '프로필을 불러오지 못했어요.',
          );
        } finally {
          if (active) setLoading(false);
        }
      })
      .catch((error) => {
        console.error(error);
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [db]);

  const openGallery = async () => {
    const permission = await MediaLibrary.requestPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('사진 권한 필요', '프로필 사진을 고르려면 사진 접근 권한이 필요해요.');
      return;
    }

    const result = await MediaLibrary.getAssetsAsync({
      first: 60,
      mediaType: ['photo'] as any,
    });
    setAssets(result.assets);
    setGalleryOpen(true);
  };

  const save = async () => {
    if (!accessToken || !trainerId) {
      Alert.alert('로그인 필요', '강사 이메일 로그인 후 프로필을 저장할 수 있어요.');
      return;
    }
    if (!name.trim()) {
      Alert.alert('이름 확인', '회원에게 표시할 강사 이름을 입력해 주세요.');
      return;
    }

    setSaving(true);
    try {
      let finalPhoto = photoUri;
      if (finalPhoto && !finalPhoto.startsWith('http')) {
        finalPhoto = await uploadTrainerProfilePhoto(accessToken, trainerId, finalPhoto);
      }

      const saved = await saveTrainerProfile(accessToken, trainerId, {
        name: name.trim(),
        bio: bio.trim() || null,
        specialties: specialties.trim() || null,
        certifications: certifications.trim() || null,
        career: career.trim() || null,
        education: education.trim() || null,
        awards: awards.trim() || null,
        instagram: instagram.trim() || null,
        profile_photo_url: finalPhoto,
      });

      setPhotoUri(saved.profile_photo_url);

      await db.runAsync(
        `INSERT INTO trainer_profile_cache (
          trainer_id, name, bio, specialties, certifications, career,
          education, awards, instagram, profile_photo_url, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(trainer_id) DO UPDATE SET
          name = excluded.name,
          bio = excluded.bio,
          specialties = excluded.specialties,
          certifications = excluded.certifications,
          career = excluded.career,
          education = excluded.education,
          awards = excluded.awards,
          instagram = excluded.instagram,
          profile_photo_url = excluded.profile_photo_url,
          updated_at = excluded.updated_at`,
        [
          trainerId,
          saved.name,
          saved.bio,
          saved.specialties,
          saved.certifications,
          saved.career,
          saved.education,
          saved.awards,
          saved.instagram,
          saved.profile_photo_url,
          saved.updated_at ?? new Date().toISOString(),
        ],
      );

      Alert.alert('저장 완료', '회원에게 보여줄 강사 프로필을 저장했어요.');
    } catch (error) {
      console.error(error);
      Alert.alert(
        '저장 실패',
        error instanceof Error ? error.message : '프로필을 저장하지 못했어요.',
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <ActivityIndicator color="#177B78" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>‹ 뒤로</Text>
        </Pressable>
        <Text style={styles.headerTitle}>내 강사 프로필</Text>
        <View style={styles.headerSide} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {!accessToken ? (
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>이메일 로그인이 필요해요</Text>
            <Text style={styles.noticeText}>
              테스트용 강사 입장에서는 서버 프로필을 저장할 수 없어요. 강사 이메일 인증으로 로그인해 주세요.
            </Text>
          </View>
        ) : null}

        <Pressable style={styles.photoWrap} onPress={() => void openGallery()}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.photo} />
          ) : (
            <View style={styles.photoFallback}>
              <Text style={styles.photoFallbackText}>사진</Text>
            </View>
          )}
          <Text style={styles.photoHint}>프로필 사진 변경</Text>
        </Pressable>

        <Field label="강사 이름" value={name} onChangeText={setName} placeholder="예: 최의철 트레이너" />
        <Field
          label="한줄 소개 / 소개글"
          value={bio}
          onChangeText={setBio}
          placeholder="회원에게 보여줄 소개를 적어 주세요."
          multiline
        />
        <Field
          label="전문 분야"
          value={specialties}
          onChangeText={setSpecialties}
          placeholder={'근력 향상\n다이어트\n체형 교정'}
          multiline
        />
        <Field
          label="자격증"
          value={certifications}
          onChangeText={setCertifications}
          placeholder={'생활스포츠지도사 2급\nNASM-CPT'}
          multiline
        />
        <Field
          label="경력사항"
          value={career}
          onChangeText={setCareer}
          placeholder={'비케이짐 대표\n퍼스널트레이닝 10년'}
          multiline
        />
        <Field
          label="교육 이력"
          value={education}
          onChangeText={setEducation}
          placeholder="수료한 교육·세미나를 입력해 주세요."
          multiline
        />
        <Field
          label="수상 / 대회 경력"
          value={awards}
          onChangeText={setAwards}
          placeholder="대회·수상 경력이 있다면 입력해 주세요."
          multiline
        />
        <Field
          label="인스타그램"
          value={instagram}
          onChangeText={setInstagram}
          placeholder="@아이디 또는 계정명"
        />

        <Pressable
          style={[styles.saveButton, saving && styles.disabled]}
          disabled={saving}
          onPress={() => void save()}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.saveText}>회원 공개 프로필 저장</Text>
          )}
        </Pressable>
      </ScrollView>

      <Modal
        visible={galleryOpen}
        animationType="slide"
        onRequestClose={() => setGalleryOpen(false)}
      >
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <Pressable onPress={() => setGalleryOpen(false)}>
              <Text style={styles.back}>닫기</Text>
            </Pressable>
            <Text style={styles.headerTitle}>프로필 사진 선택</Text>
            <View style={styles.headerSide} />
          </View>
          <ScrollView contentContainerStyle={styles.gallery}>
            {assets.map((asset) => (
              <Pressable
                key={asset.id}
                style={styles.assetButton}
                onPress={() => {
                  setPhotoUri(asset.uri);
                  setGalleryOpen(false);
                }}
              >
                <Image source={{ uri: asset.uri }} style={styles.assetImage} />
              </Pressable>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#A4A9B1"
        multiline={multiline}
        style={[styles.input, multiline && styles.inputMultiline]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F4F6FA' },
  header: {
    height: 58,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E4E7EC',
  },
  back: { width: 78, fontSize: 14, fontWeight: '800', color: '#177B78' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '900', color: '#252A32' },
  headerSide: { width: 78 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 18, paddingBottom: 60 },
  notice: { marginBottom: 16, padding: 14, borderRadius: 16, backgroundColor: '#FFF3E8' },
  noticeTitle: { fontSize: 13, fontWeight: '900', color: '#8A542A' },
  noticeText: { marginTop: 5, fontSize: 11, lineHeight: 17, color: '#8A6A50' },
  photoWrap: { alignItems: 'center', marginBottom: 22 },
  photo: { width: 112, height: 112, borderRadius: 34, backgroundColor: '#E8EBF0' },
  photoFallback: {
    width: 112,
    height: 112,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F5F3',
  },
  photoFallbackText: { fontSize: 18, fontWeight: '900', color: '#177B78' },
  photoHint: { marginTop: 9, fontSize: 11, fontWeight: '800', color: '#177B78' },
  field: { marginBottom: 16 },
  label: { marginBottom: 7, fontSize: 12, fontWeight: '900', color: '#505762' },
  input: {
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#DDE1E7',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    fontSize: 13,
    color: '#262B33',
  },
  inputMultiline: { minHeight: 96, textAlignVertical: 'top' },
  saveButton: {
    height: 54,
    marginTop: 8,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#177B78',
  },
  disabled: { opacity: 0.55 },
  saveText: { fontSize: 14, fontWeight: '900', color: '#FFFFFF' },
  gallery: { flexDirection: 'row', flexWrap: 'wrap', padding: 3 },
  assetButton: { width: '25%', aspectRatio: 1, padding: 2 },
  assetImage: { width: '100%', height: '100%', borderRadius: 8, backgroundColor: '#E5E7EB' },
});
