import React, { useState, useEffect, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Modal,
  Alert,
  Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';

export default function App() {
  // ========== STATE ==========
  const [tab, setTab] = useState('city');
  const [coins, setCoins] = useState(420);
  const [streak, setStreak] = useState(5);
  const [totalMinutes, setTotalMinutes] = useState(680);
  const [buildings, setBuildings] = useState([
    { id: 1, type: 'house', x: 1, y: 1 },
    { id: 2, type: 'tree', x: 3, y: 1 },
    { id: 3, type: 'shop', x: 2, y: 2 },
    { id: 4, type: 'tree', x: 0, y: 2 },
    { id: 5, type: 'park', x: 3, y: 3 },
  ]);
  const [activities, setActivities] = useState([
    { id: 1, type: 'jogging', title: 'Morning run', duration: 35, notes: '5km along the river.', timestamp: Date.now() - 3 * 3600 * 1000, reward: 50 },
    { id: 2, type: 'painting', title: 'Watercolor practice', duration: 60, notes: 'Worked on shading.', timestamp: Date.now() - 26 * 3600 * 1000, reward: 80 },
  ]);
  const [focusSessions, setFocusSessions] = useState([
    { id: 1, duration: 25, timestamp: Date.now() - 3 * 3600 * 1000 },
    { id: 2, duration: 50, timestamp: Date.now() - 24 * 3600 * 1000 },
    { id: 3, duration: 25, timestamp: Date.now() - 48 * 3600 * 1000 },
  ]);
  const [toast, setToast] = useState(null);
  const toastAnim = useRef(new Animated.Value(0)).current;

  // Profile state
  const [profiles, setProfiles] = useState([]);
  const [currentProfileId, setCurrentProfileId] = useState('default');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');

  // Health state
  const [steps, setSteps] = useState(0);

  // ========== PROFILE FUNCTIONS ==========
  const loadAllProfiles = async () => {
    try {
      const saved = await AsyncStorage.getItem('profiles');
      if (saved) {
        const parsed = JSON.parse(saved);
        setProfiles(parsed);
        const lastProfile = await AsyncStorage.getItem('currentProfileId');
        if (lastProfile && parsed.find(p => p.id === lastProfile)) {
          setCurrentProfileId(lastProfile);
          await loadProfileData(lastProfile);
        } else if (parsed.length > 0) {
          setCurrentProfileId(parsed[0].id);
          await loadProfileData(parsed[0].id);
        }
      } else {
        const defaultProfile = {
          id: 'default',
          name: 'Default',
          coins: 420,
          streak: 5,
          totalMinutes: 680,
          buildings: [],
          activities: [],
          focusSessions: [],
          createdAt: Date.now(),
        };
        setProfiles([defaultProfile]);
        setCurrentProfileId('default');
        await AsyncStorage.setItem('profiles', JSON.stringify([defaultProfile]));
        await AsyncStorage.setItem('currentProfileId', 'default');
        await loadProfileData('default');
      }
    } catch (e) {
      console.log('Error loading profiles:', e);
    }
  };

  const loadProfileData = async (profileId) => {
    try {
      const data = await AsyncStorage.getItem(`profile_${profileId}`);
      if (data) {
        const parsed = JSON.parse(data);
        setCoins(parsed.coins);
        setTotalMinutes(parsed.totalMinutes);
        setBuildings(parsed.buildings);
        setActivities(parsed.activities);
        setFocusSessions(parsed.focusSessions);
      }
    } catch (e) {
      console.log('Error loading profile data:', e);
    }
  };

  const saveCurrentProfile = async () => {
    try {
      const profileData = { coins, totalMinutes, buildings, activities, focusSessions };
      await AsyncStorage.setItem(`profile_${currentProfileId}`, JSON.stringify(profileData));
      const updatedProfiles = profiles.map(p =>
        p.id === currentProfileId ? { ...p, coins, streak: p.streak, totalMinutes } : p
      );
      setProfiles(updatedProfiles);
      await AsyncStorage.setItem('profiles', JSON.stringify(updatedProfiles));
    } catch (e) {
      console.log('Error saving profile:', e);
    }
  };

  const createProfile = async (name) => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a profile name');
      return;
    }
    const newProfile = {
      id: Date.now().toString(),
      name: name.trim(),
      coins: 100,
      streak: 0,
      totalMinutes: 0,
      buildings: [],
      activities: [],
      focusSessions: [],
      createdAt: Date.now(),
    };
    const updatedProfiles = [...profiles, newProfile];
    setProfiles(updatedProfiles);
    await AsyncStorage.setItem('profiles', JSON.stringify(updatedProfiles));
    await saveCurrentProfile();
    setCurrentProfileId(newProfile.id);
    await AsyncStorage.setItem('currentProfileId', newProfile.id);
    await loadProfileData(newProfile.id);
    setShowProfileModal(false);
    setNewProfileName('');
    showToast(`Profile "${name}" created!`, '👤');
  };

  const switchProfile = async (profileId) => {
    if (profileId === currentProfileId) return;
    await saveCurrentProfile();
    setCurrentProfileId(profileId);
    await AsyncStorage.setItem('currentProfileId', profileId);
    await loadProfileData(profileId);
    setShowProfileModal(false);
    showToast(`Switched to ${profiles.find(p => p.id === profileId)?.name}`, '🔄');
  };

  const deleteProfile = async (profileId) => {
    if (profileId === 'default') {
      Alert.alert('Cannot Delete', 'Default profile cannot be deleted');
      return;
    }
    Alert.alert(
      'Delete Profile',
      'Are you sure? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem(`profile_${profileId}`);
            const updatedProfiles = profiles.filter(p => p.id !== profileId);
            setProfiles(updatedProfiles);
            await AsyncStorage.setItem('profiles', JSON.stringify(updatedProfiles));
            if (currentProfileId === profileId) {
              const defaultProfile = updatedProfiles.find(p => p.id === 'default');
              if (defaultProfile) {
                setCurrentProfileId('default');
                await loadProfileData('default');
              }
            }
            showToast('Profile deleted', '🗑️');
          },
        },
      ]
    );
  };

    // ========== EXPORT FUNCTION (Updated for Expo SDK 54+) ==========
    const exportData = async () => {
  try {
    let tsvData = 'Type\tID\tTitle\tDuration\tReward\tTimestamp\tNotes\n';
    
    focusSessions.forEach(s => {
      tsvData += `Focus\t${s.id}\t-\t${s.duration}\t${s.duration * 2}\t${new Date(s.timestamp).toISOString()}\t-\n`;
    });
    
    activities.forEach(a => {
      tsvData += `Activity\t${a.id}\t${a.title}\t${a.duration}\t${a.reward}\t${new Date(a.timestamp).toISOString()}\t${a.notes || '-'}\n`;
    });
    
    buildings.forEach(b => {
      tsvData += `Building\t${b.id}\t${b.type}\t-\t-\t-\t${b.x},${b.y}\n`;
    });
    
    tsvData += `Stats\tTotalMinutes\t${totalMinutes}\t-\t-\t-\t-\n`;
    tsvData += `Stats\tTotalCoins\t${coins}\t-\t-\t-\t-\n`;
    tsvData += `Stats\tStreak\t${streak}\t-\t-\t-\t-\n`;

    // New File API (Expo SDK 54+)
    const fileName = `focuscity_export_${Date.now()}.tsv`;
    const fileUri = FileSystem.documentDirectory + fileName;
    
    // Write file using the new API
    const file = await FileSystem.writeAsStringAsync(fileUri, tsvData);
    
    // Share
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/tab-separated-values',
        dialogTitle: 'Export FocusCity Data',
      });
      showToast('Data exported!', '📤');
    } else {
      Alert.alert('Share not available', 'Cannot share files on this device');
    }
  } catch (e) {
    console.log('Export error:', e);
    Alert.alert('Export Failed', 'Could not export data: ' + e.message);
    }
  };

  // ========== HEALTH FUNCTIONS ==========
  const addManualSteps = () => {
    Alert.alert(
      'Add Steps',
      'How many steps did you take?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add 1000',
          onPress: () => {
            setSteps(s => s + 1000);
            setCoins(c => c + 1);
            showToast(`+1 coin for 1000 steps!`, '👟');
          },
        },
        {
          text: 'Add 5000',
          onPress: () => {
            setSteps(s => s + 5000);
            setCoins(c => c + 5);
            showToast(`+5 coins for 5000 steps!`, '👟');
          },
        },
      ]
    );
  };

  // ========== CORE FUNCTIONS ==========
  const showToast = (msg, icon = '✨') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setToast({ msg, icon });
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2000),
      Animated.timing(toastAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setToast(null));
  };

  const onFocusComplete = (minutes) => {
    const reward = minutes * 2;
    setCoins(c => c + reward);
    setTotalMinutes(m => m + minutes);
    setFocusSessions(s => [{ id: Date.now(), duration: minutes, timestamp: Date.now() }, ...s]);
    showToast(`+${reward} coins for ${minutes}m focus!`, '🎯');
    saveCurrentProfile();
  };

  const onActivityLogged = (a) => {
    setActivities(arr => [{ ...a, id: Date.now(), imageUri: a.imageUri || null }, ...arr]);
    setCoins(c => c + a.reward);
    showToast(`+${a.reward} coins logged!`, '🌱');
    saveCurrentProfile();
  };

  const onActivityDelete = (id) => setActivities(a => a.filter(x => x.id !== id));

  const onBuildingPurchase = (b) => {
    if (coins < b.cost) {
      showToast(`Need ${b.cost - coins} more coins`, '💸');
      return;
    }
    setCoins(c => c - b.cost);
    const occupied = new Set(buildings.map(x => `${x.x},${x.y}`));
    let placed = false;
    for (let y = 0; y < 4 && !placed; y++) {
      for (let x = 0; x < 4 && !placed; x++) {
        if (!occupied.has(`${x},${y}`)) {
          setBuildings(bs => [...bs, { id: Date.now(), type: b.type, x, y }]);
          placed = true;
        }
      }
    }
    if (!placed) showToast('City is full!', '🏙️');
    else showToast(`Placed a ${b.label}!`, b.icon);
    saveCurrentProfile();
  };

  // ========== INIT ==========
  useEffect(() => {
    loadAllProfiles();
  }, []);

  useEffect(() => {
    if (currentProfileId !== 'loading') {
      saveCurrentProfile();
    }
  }, [coins, totalMinutes, buildings, activities, focusSessions]);

  // ========== RENDER ==========
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logo}><Text style={{ fontSize: 18 }}>✨</Text></View>
          <View>
            <Text style={styles.title}>FocusCity</Text>
            <Text style={styles.subtitle}>Build by being present</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <View style={[styles.pill, { backgroundColor: '#FEF3C7' }]}>
            <Text style={[styles.pillText, { color: '#B45309' }]}>🪙 {coins}</Text>
          </View>
          <TouchableOpacity onPress={() => setShowProfileModal(true)} style={styles.iconBtn}>
            <Text style={{ fontSize: 22 }}>👤</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content */}
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {tab === 'city' && <CityView buildings={buildings} coins={coins} totalMinutes={totalMinutes} onPurchase={onBuildingPurchase} />}
        {tab === 'focus' && <FocusView onComplete={onFocusComplete} />}
        {tab === 'log' && <ActivityLog activities={activities} onSave={onActivityLogged} onDelete={onActivityDelete} />}
        {tab === 'stats' && <StatsView focusSessions={focusSessions} activities={activities} totalMinutes={totalMinutes} streak={streak} coins={coins} buildings={buildings} onExport={exportData} />}
        {tab === 'health' && <HealthView steps={steps} onAddSteps={addManualSteps} />}
      </ScrollView>

      {/* Toast */}
      {toast && (
        <Animated.View style={[styles.toast, { opacity: toastAnim }]}>
          <Text style={{ color: '#fff' }}>{toast.icon}  {toast.msg}</Text>
        </Animated.View>
      )}

      {/* Profile Modal */}
      <ProfileModal
        visible={showProfileModal}
        profiles={profiles}
        currentProfileId={currentProfileId}
        newProfileName={newProfileName}
        setNewProfileName={setNewProfileName}
        onSwitchProfile={switchProfile}
        onCreateProfile={createProfile}
        onDeleteProfile={deleteProfile}
        onClose={() => setShowProfileModal(false)}
      />

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TabBtn active={tab === 'city'} onPress={() => setTab('city')} icon="🏠" label="City" />
        <TabBtn active={tab === 'focus'} onPress={() => setTab('focus')} icon="🎯" label="Focus" />
        <TabBtn active={tab === 'log'} onPress={() => setTab('log')} icon="📝" label="Log" />
        <TabBtn active={tab === 'stats'} onPress={() => setTab('stats')} icon="📊" label="Stats" />
        <TabBtn active={tab === 'health'} onPress={() => setTab('health')} icon="❤️" label="Health" />
      </View>
    </SafeAreaView>
  );
}

// ========== COMPONENTS ==========

const TabBtn = ({ active, onPress, icon, label }) => (
  <TouchableOpacity onPress={onPress} style={styles.tabBtn}>
    <Text style={{ fontSize: 22 }}>{icon}</Text>
    <Text style={[styles.tabLabel, { color: active ? '#2563EB' : '#94A3B8' }]}>{label}</Text>
  </TouchableOpacity>
);

function CityView({ buildings, coins, totalMinutes, onPurchase }) {
  const SHOP = [
    { type: 'house', label: 'House', icon: '🏠', cost: 100 },
    { type: 'tree', label: 'Tree', icon: '🌳', cost: 30 },
    { type: 'shop', label: 'Shop', icon: '🏪', cost: 200 },
    { type: 'park', label: 'Park', icon: '🌷', cost: 150 },
    { type: 'tower', label: 'Tower', icon: '🗼', cost: 500 },
    { type: 'fountain', label: 'Fountain', icon: '⛲', cost: 250 },
  ];
  const icons = { house: '🏠', tree: '🌳', shop: '🏪', park: '🌷', tower: '🗼', fountain: '⛲' };
  const lookup = new Map(buildings.map(b => [`${b.x},${b.y}`, b]));

  return (
    <View>
      <View style={styles.cityCard}>
        <View style={styles.cityBadgeRow}>
          <View style={styles.cityBadge}><Text style={styles.cityBadgeText}>Your city</Text></View>
          <View style={styles.cityBadge}><Text style={styles.cityBadgeText}>{buildings.length} structures</Text></View>
        </View>
        <View style={styles.grid}>
          {Array.from({ length: 16 }).map((_, i) => {
            const x = i % 4, y = Math.floor(i / 4);
            const b = lookup.get(`${x},${y}`);
            return (
              <View key={i} style={styles.tile}>
                {b && <Text style={{ fontSize: 28 }}>{icons[b.type]}</Text>}
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.statsRow}>
        <QuickStat icon="⏱️" value={`${Math.floor(totalMinutes / 60)}h`} label="Focused" bg="#DBEAFE" color="#1D4ED8" />
        <QuickStat icon="🏗️" value={String(buildings.length)} label="Buildings" bg="#F3E8FF" color="#7E22CE" />
        <QuickStat icon="🪙" value={String(coins)} label="Coins" bg="#FEF3C7" color="#B45309" />
      </View>

      <SectionTitle>Build something</SectionTitle>
      <View style={styles.shopGrid}>
        {SHOP.map(s => (
          <TouchableOpacity key={s.type} onPress={() => onPurchase(s)} disabled={coins < s.cost}
            style={[styles.shopItem, coins < s.cost && { opacity: 0.5 }]}>
            <Text style={{ fontSize: 32 }}>{s.icon}</Text>
            <Text style={styles.shopLabel}>{s.label}</Text>
            <Text style={styles.shopCost}>🪙 {s.cost}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const QuickStat = ({ icon, value, label, bg, color }) => (
  <View style={[styles.quickStat, { backgroundColor: bg }]}>
    <Text style={[styles.quickStatLabel, { color }]}>{icon} {label}</Text>
    <Text style={[styles.quickStatValue, { color }]}>{value}</Text>
  </View>
);

const SectionTitle = ({ children, action }) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>{children}</Text>
    {action}
  </View>
);

function FocusView({ onComplete }) {
  const PRESETS = [15, 25, 50];
  const [chosen, setChosen] = useState(25);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) {
          clearInterval(intervalRef.current);
          setRunning(false);
          onComplete(chosen);
          return chosen * 60;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [running, chosen]);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const progress = 1 - secondsLeft / (chosen * 60);

  return (
    <View>
      <SectionTitle>Focus session</SectionTitle>
      <View style={styles.focusCard}>
        <View style={styles.timerCircle}>
          <Text style={styles.timerText}>{String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}</Text>
          <Text style={styles.timerSub}>🪙 +{chosen * 2} coins on complete</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <View style={styles.presetRow}>
          {PRESETS.map(m => (
            <TouchableOpacity key={m} onPress={() => { setChosen(m); setSecondsLeft(m * 60); }} disabled={running}
              style={[styles.preset, chosen === m && styles.presetActive]}>
              <Text style={[styles.presetText, chosen === m && { color: '#fff' }]}>{m}m</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity onPress={() => setRunning(r => !r)} style={styles.startBtn}>
          <Text style={styles.startBtnText}>{running ? '⏸ Pause' : '▶ Start focus'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function ActivityLog({ activities, onSave, onDelete }) {
  const [showForm, setShowForm] = useState(false);
  const TYPES = [
    { id: 'jogging', label: 'Jogging', icon: '🏃' },
    { id: 'painting', label: 'Painting', icon: '🎨' },
    { id: 'singing', label: 'Singing', icon: '🎤' },
    { id: 'reading', label: 'Reading', icon: '📚' },
    { id: 'cooking', label: 'Cooking', icon: '🍳' },
    { id: 'meditation', label: 'Meditation', icon: '🧘' },
    { id: 'workout', label: 'Workout', icon: '💪' },
    { id: 'other', label: 'Other', icon: '✨' },
  ];
  const fmt = (ts) => {
    const m = Math.floor((Date.now() - ts) / 60000);
    if (m < 60) return `${m}m ago`;
    if (m < 1440) return `${Math.floor(m / 60)}h ago`;
    return `${Math.floor(m / 1440)}d ago`;
  };

  return (
    <View>
      <SectionTitle action={
        <TouchableOpacity onPress={() => setShowForm(true)} style={styles.addBtn}>
          <Text style={styles.addBtnText}>+ Log</Text>
        </TouchableOpacity>
      }>Real-world activities</SectionTitle>

      {activities.length === 0 ? (
        <View style={styles.empty}><Text style={{ fontSize: 36 }}>🌱</Text><Text style={styles.emptyText}>No activities logged yet.</Text></View>
      ) : (
        activities.map(a => {
          const type = TYPES.find(t => t.id === a.type) || TYPES[7];
          return (
            <View key={a.id} style={styles.activity}>
              <View style={styles.activityIcon}><Text style={{ fontSize: 22 }}>{type.icon}</Text></View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={styles.activityTitle}>{a.title}</Text>
                  <TouchableOpacity onPress={() => onDelete(a.id)}><Text>🗑</Text></TouchableOpacity>
                </View>
                <Text style={styles.activityMeta}>⏱ {a.duration}m · {fmt(a.timestamp)} · 🪙 +{a.reward}</Text>
                {a.notes ? <Text style={styles.activityNotes}>{a.notes}</Text> : null}
              </View>
            </View>
          );
        })
      )}

      <ActivityFormModal visible={showForm} types={TYPES} onCancel={() => setShowForm(false)} onSave={(a) => { onSave(a); setShowForm(false); }} />
    </View>
  );
}

function ActivityFormModal({ visible, types, onCancel, onSave }) {
  const [type, setType] = useState('jogging');
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState(30);
  const [notes, setNotes] = useState('');
  const [imageUri, setImageUri] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);

  // Reset form when modal closes
  useEffect(() => {
    if (!visible) {
      setType('jogging');
      setTitle('');
      setDuration(30);
      setNotes('');
      setImageUri(null);
      setImageBase64(null);
    }
  }, [visible]);

  // Request permissions and pick image
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photos to attach evidence');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
      setImageBase64(result.assets[0].base64);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const removeImage = () => {
    setImageUri(null);
    setImageBase64(null);
  };

  const handleSave = () => {
    if (title.trim()) {
      onSave({
        type,
        title: title.trim(),
        duration,
        notes: notes.trim(),
        timestamp: Date.now(),
        reward: duration,
        imageUri: imageUri,
        imageBase64: imageBase64,
      });
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>📝 Log Activity</Text>
            <TouchableOpacity onPress={onCancel}>
              <Text style={{ fontSize: 20, color: '#94A3B8' }}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16 }}>
            {/* Activity Type */}
            <Text style={styles.label}>ACTIVITY TYPE</Text>
            <View style={styles.typeGrid}>
              {types.map(t => (
                <TouchableOpacity
                  key={t.id}
                  onPress={() => setType(t.id)}
                  style={[styles.typeItem, type === t.id && styles.typeItemActive]}
                >
                  <Text style={{ fontSize: 24 }}>{t.icon}</Text>
                  <Text style={styles.typeLabel}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Title */}
            <Text style={styles.label}>TITLE</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="e.g., Morning run along the river"
              style={styles.input}
            />

            {/* Duration */}
            <Text style={styles.label}>DURATION: {duration} MIN</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {[10, 15, 20, 30, 45, 60, 90, 120].map(m => (
                <TouchableOpacity
                  key={m}
                  onPress={() => setDuration(m)}
                  style={[styles.durationChip, duration === m && styles.durationChipActive]}
                >
                  <Text style={[styles.durationChipText, duration === m && { color: '#fff' }]}>{m}m</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Notes */}
            <Text style={styles.label}>NOTES / REFLECTIONS</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="How did it feel? Any thoughts?"
              multiline
              numberOfLines={3}
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
            />

            {/* PHOTO EVIDENCE - NEW SECTION */}
            <Text style={styles.label}>📷 PHOTO EVIDENCE (Optional)</Text>
            
            {imageUri ? (
              <View style={styles.imagePreviewContainer}>
                <Image source={{ uri: imageUri }} style={styles.imagePreview} />
                <View style={styles.imageButtonsRow}>
                  <TouchableOpacity onPress={pickImage} style={styles.imageButton}>
                    <Text>🔄 Change</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={removeImage} style={[styles.imageButton, styles.removeButton]}>
                    <Text>🗑️ Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity onPress={pickImage} style={styles.addPhotoBtn}>
                <Text style={{ fontSize: 24 }}>📷</Text>
                <Text style={styles.addPhotoText}>Add Photo Evidence</Text>
              </TouchableOpacity>
            )}

            {/* Reward Preview */}
            <View style={styles.rewardBox}>
              <Text style={{ color: '#92400E', fontWeight: '500' }}>🏆 Reward</Text>
              <Text style={{ color: '#B45309', fontWeight: 'bold', fontSize: 18 }}>
                +{duration} coins
              </Text>
              {imageUri && (
                <Text style={{ fontSize: 11, color: '#10B981', marginTop: 4 }}>
                  📷 Photo attached (+ bonus)
                </Text>
              )}
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity onPress={onCancel} style={styles.cancelBtn}>
              <Text style={{ color: '#475569', fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSave}
              disabled={!title.trim()}
              style={[styles.saveBtn, !title.trim() && { opacity: 0.5 }]}
            >
              <Text style={{ color: '#fff', fontWeight: '600' }}>✓ Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function StatsView({ focusSessions, activities, totalMinutes, streak, coins, buildings, onExport }) {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - i);
    const start = d.getTime();
    const end = start + 86400000;
    const focus = focusSessions.filter(s => s.timestamp >= start && s.timestamp < end).reduce((s, x) => s + x.duration, 0);
    const act = activities.filter(a => a.timestamp >= start && a.timestamp < end).reduce((s, x) => s + x.duration, 0);
    days.push({ day: d.toLocaleDateString('en', { weekday: 'short' }), focus, act });
  }
  const max = Math.max(60, ...days.map(d => d.focus + d.act));

  const achievements = [
    { icon: '🎯', label: 'First focus', unlocked: focusSessions.length > 0 },
    { icon: '🔥', label: '3-day streak', unlocked: streak >= 3 },
    { icon: '⚡', label: '7-day streak', unlocked: streak >= 7 },
    { icon: '🌱', label: 'Logged 5', unlocked: activities.length >= 5 },
    { icon: '💰', label: '500 coins', unlocked: coins >= 500 },
    { icon: '🏙️', label: '10 buildings', unlocked: buildings.length >= 10 },
  ];

  return (
    <View>
      <SectionTitle>Your stats</SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <BigStat icon="⏱" value={`${Math.floor(totalMinutes / 60)}h`} label="Focus time" colors="#3B82F6" />
        <BigStat icon="🔥" value={streak} label="Streak" colors="#F97316" />
        <BigStat icon="📈" value={focusSessions.length} label="Sessions" colors="#10B981" />
        <BigStat icon="🌱" value={activities.length} label="Activities" colors="#A855F7" />
      </View>
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Past 7 days</Text>
        <View style={styles.chartArea}>
          {days.map((d, i) => (
            <View key={i} style={styles.barWrap}>
              <View style={styles.barCol}>
                {d.act > 0 && <View style={{ height: `${(d.act / max) * 100}%`, backgroundColor: '#10B981', borderTopLeftRadius: 4, borderTopRightRadius: 4 }} />}
                {d.focus > 0 && <View style={{ height: `${(d.focus / max) * 100}%`, backgroundColor: '#3B82F6', borderTopLeftRadius: d.act === 0 ? 4 : 0, borderTopRightRadius: d.act === 0 ? 4 : 0 }} />}
              </View>
              <Text style={styles.barLabel}>{d.day}</Text>
            </View>
          ))}
        </View>
      </View>
      <SectionTitle>Achievements</SectionTitle>
      <View style={styles.achGrid}>
        {achievements.map(a => (
          <View key={a.label} style={[styles.achItem, !a.unlocked && { opacity: 0.4 }]}>
            <Text style={{ fontSize: 28 }}>{a.icon}</Text>
            <Text style={styles.achLabel}>{a.label}</Text>
            {a.unlocked && <Text style={styles.achUnlocked}>🏆</Text>}
          </View>
        ))}
      </View>
      <TouchableOpacity onPress={onExport} style={styles.exportBtn}><Text style={styles.exportBtnText}>📤 Export Data</Text></TouchableOpacity>
    </View>
  );
}

const BigStat = ({ icon, value, label, colors }) => (
  <View style={[styles.bigStat, { backgroundColor: colors }]}>
    <Text style={styles.bigStatLabel}>{icon} {label}</Text>
    <Text style={styles.bigStatValue}>{value}</Text>
  </View>
);

function HealthView({ steps, onAddSteps }) {
  return (
    <View>
      <SectionTitle>❤️ Health Integration</SectionTitle>
      <View style={styles.healthCard}>
        <Text style={styles.stepsNumber}>{steps.toLocaleString()}</Text>
        <Text style={styles.stepsLabel}>steps today</Text>
        <View style={styles.coinBonusCard}>
          <Text style={{ fontSize: 24 }}>🪙</Text>
          <Text>Every 1,000 steps = +1 coin!</Text>
        </View>
        <TouchableOpacity onPress={onAddSteps} style={styles.addStepsBtn}>
          <Text style={styles.addStepsBtnText}>+ Add Steps Manually</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function ProfileModal({ visible, profiles, currentProfileId, newProfileName, setNewProfileName, onSwitchProfile, onCreateProfile, onDeleteProfile, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>👤 Profiles</Text>
          <ScrollView style={{ maxHeight: 300 }}>
            {profiles.map(p => (
              <View key={p.id} style={styles.profileItemContainer}>
                <TouchableOpacity onPress={() => onSwitchProfile(p.id)} style={[styles.profileItem, currentProfileId === p.id && styles.profileItemActive]}>
                  <Text style={{ fontSize: 28 }}>👤</Text>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.profileName}>{p.name}</Text>
                    <Text style={styles.profileStats}>{p.totalMinutes} min focused</Text>
                  </View>
                  {currentProfileId === p.id && <Text style={{ fontSize: 18, color: '#2563EB' }}>✓</Text>}
                </TouchableOpacity>
                {p.id !== 'default' && (
                  <TouchableOpacity onPress={() => onDeleteProfile(p.id)} style={styles.deleteProfileBtn}>
                    <Text style={{ fontSize: 18 }}>🗑️</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </ScrollView>
          <View style={styles.createProfileSection}>
            <TextInput placeholder="New profile name" value={newProfileName} onChangeText={setNewProfileName} style={styles.input} />
            <TouchableOpacity onPress={() => onCreateProfile(newProfileName)} style={styles.createBtn}><Text style={{ color: '#fff' }}>+ Create</Text></TouchableOpacity>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}><Text>Close</Text></TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ========== STYLES ==========
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#EFF6FF' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  logo: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#3B82F6', alignItems: 'center', justifyContent: 'center' },
  title: { fontWeight: 'bold', color: '#0F172A', fontSize: 15 },
  subtitle: { fontSize: 11, color: '#64748B' },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  pillText: { fontWeight: 'bold', fontSize: 13 },
  iconBtn: { marginLeft: 8, width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 16, paddingBottom: 100 },
  toast: { position: 'absolute', top: 80, alignSelf: 'center', backgroundColor: '#0F172A', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999 },
  tabBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingBottom: 16 },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  tabLabel: { fontSize: 11, fontWeight: '500', marginTop: 2 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, marginTop: 8 },
  sectionTitle: { fontWeight: 'bold', color: '#0F172A', fontSize: 16 },
  cityCard: { backgroundColor: '#7DD3FC', borderRadius: 24, padding: 14, marginBottom: 14 },
  cityBadgeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  cityBadge: { backgroundColor: 'rgba(255,255,255,0.6)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  cityBadgeText: { fontSize: 11, color: '#334155', fontWeight: '500' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  tile: { width: '23.5%', aspectRatio: 1, borderRadius: 8, backgroundColor: 'rgba(110,231,183,0.7)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(52,211,153,0.4)' },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  quickStat: { flex: 1, padding: 12, borderRadius: 16 },
  quickStatLabel: { fontSize: 11, fontWeight: '500', marginBottom: 4 },
  quickStatValue: { fontSize: 18, fontWeight: 'bold' },
  shopGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  shopItem: { width: '31%', backgroundColor: '#fff', padding: 12, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#F1F5F9' },
  shopLabel: { marginTop: 4, fontWeight: '500', color: '#1E293B', fontSize: 13 },
  shopCost: { color: '#D97706', fontWeight: '600', fontSize: 12, marginTop: 2 },
  focusCard: { backgroundColor: '#fff', borderRadius: 24, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: '#F1F5F9' },
  timerCircle: { width: 200, height: 200, borderRadius: 100, borderWidth: 8, borderColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center', marginVertical: 12 },
  timerText: { fontSize: 44, fontWeight: 'bold', color: '#0F172A' },
  timerSub: { fontSize: 11, color: '#64748B', marginTop: 4 },
  progressTrack: { width: '100%', height: 6, backgroundColor: '#E2E8F0', borderRadius: 3, overflow: 'hidden', marginVertical: 12 },
  progressFill: { height: '100%', backgroundColor: '#3B82F6', borderRadius: 3 },
  presetRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  preset: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 999, backgroundColor: '#F1F5F9' },
  presetActive: { backgroundColor: '#2563EB' },
  presetText: { color: '#475569', fontWeight: '600', fontSize: 13 },
  startBtn: { width: '100%', paddingVertical: 12, borderRadius: 12, backgroundColor: '#2563EB', alignItems: 'center' },
  startBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  addBtn: { backgroundColor: '#2563EB', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  addBtnText: { color: '#fff', fontWeight: '500', fontSize: 13 },
  empty: { backgroundColor: '#fff', padding: 30, borderRadius: 16, alignItems: 'center' },
  emptyText: { color: '#64748B', marginTop: 6 },
  activity: { backgroundColor: '#fff', padding: 12, borderRadius: 16, flexDirection: 'row', gap: 10, marginBottom: 8, borderWidth: 1, borderColor: '#F1F5F9' },
  activityIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  activityTitle: { fontWeight: '600', color: '#0F172A', flex: 1 },
  activityMeta: { fontSize: 11, color: '#64748B' },
  activityNotes: { fontSize: 13, color: '#475569', marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { backgroundColor: '#fff', borderRadius: 24, padding: 20, width: '90%', maxWidth: 400 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#0F172A', marginBottom: 16, textAlign: 'center' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  label: { fontSize: 11, fontWeight: '600', color: '#64748B', marginBottom: 8, marginTop: 12 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  typeItem: { width: '23%', alignItems: 'center', padding: 8, borderRadius: 12, borderWidth: 2, borderColor: '#F1F5F9' },
  typeItemActive: { borderColor: '#3B82F6', backgroundColor: '#DBEAFE' },
  typeLabel: { fontSize: 11, color: '#334155', marginTop: 2 },
  input: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  durationChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: '#F1F5F9' },
  durationChipActive: { backgroundColor: '#2563EB' },
  durationChipText: { color: '#475569', fontWeight: '600', fontSize: 13 },
  rewardBox: { backgroundColor: '#FEF3C7', borderRadius: 12, padding: 12, alignItems: 'center', marginTop: 14 },
  modalFooter: { flexDirection: 'row', gap: 8, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: '#F1F5F9', alignItems: 'center' },
  saveBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: '#2563EB', alignItems: 'center' },
  chartCard: { backgroundColor: '#fff', padding: 14, borderRadius: 16, marginTop: 12, borderWidth: 1, borderColor: '#F1F5F9' },
  chartTitle: { fontWeight: '600', color: '#0F172A', marginBottom: 10 },
  chartArea: { flexDirection: 'row', alignItems: 'flex-end', height: 140, gap: 6 },
  barWrap: { flex: 1, alignItems: 'center' },
  barCol: { width: '100%', height: 120, justifyContent: 'flex-end' },
  barLabel: { fontSize: 11, color: '#64748B', marginTop: 4 },
  achGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  achItem: { width: '31.5%', backgroundColor: '#fff', padding: 12, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#FDE68A' },
  achLabel: { fontSize: 11, color: '#334155', textAlign: 'center', fontWeight: '500', marginTop: 4 },
  achUnlocked: { fontSize: 10, color: '#D97706', fontWeight: '600', marginTop: 2 },
  bigStat: { width: '48.5%', padding: 14, borderRadius: 16 },
  bigStatLabel: { color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: '500', marginBottom: 4 },
  bigStatValue: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  profileItemContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  profileItem: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, backgroundColor: '#F8FAFC' },
  profileItemActive: { backgroundColor: '#DBEAFE', borderWidth: 1, borderColor: '#2563EB' },
  profileName: { fontWeight: '600', color: '#0F172A', fontSize: 16 },
  profileStats: { fontSize: 11, color: '#64748B' },
  deleteProfileBtn: { padding: 12, marginLeft: 8 },
  createProfileSection: { flexDirection: 'row', gap: 8, marginTop: 16, marginBottom: 16 },
  createBtn: { backgroundColor: '#2563EB', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  closeBtn: { paddingVertical: 12, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  exportBtn: { backgroundColor: '#10B981', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  exportBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  healthCard: { backgroundColor: '#fff', borderRadius: 20, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: '#F1F5F9' },
  stepsNumber: { fontSize: 48, fontWeight: 'bold', color: '#0F172A' },
  stepsLabel: { fontSize: 14, color: '#64748B', marginBottom: 16 },
  coinBonusCard: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF3C7', padding: 12, borderRadius: 12, marginBottom: 16 },
  addStepsBtn: { backgroundColor: '#3B82F6', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 999, marginBottom: 16 },
  addStepsBtnText: { color: '#fff', fontWeight: '600' },
  // Add these to your styles
addPhotoBtn: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  backgroundColor: '#F1F5F9',
  padding: 16,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: '#E2E8F0',
  borderStyle: 'dashed',
  marginBottom: 12,
},
addPhotoText: {
  color: '#64748B',
  fontSize: 14,
},
imagePreviewContainer: {
  alignItems: 'center',
  marginBottom: 12,
},
imagePreview: {
  width: 120,
  height: 120,
  borderRadius: 12,
  marginBottom: 8,
},
imageButtonsRow: {
  flexDirection: 'row',
  gap: 12,
},
imageButton: {
  paddingHorizontal: 16,
  paddingVertical: 6,
  backgroundColor: '#F1F5F9',
  borderRadius: 8,
},
removeButton: {
  backgroundColor: '#FEE2E2',
},
imageText: {
  fontSize: 11,
  color: '#10B981',
  marginTop: 4,
},
});