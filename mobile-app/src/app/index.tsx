import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  StatusBar,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import { SHEETS, SheetMeta, Problem } from '../data/sheets';

const STORAGE_KEY = '@dsa_completed_problems';

export default function HomeScreen() {
  const [selectedSheetId, setSelectedSheetId] = useState<string>('strivers-a2z');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDifficulties, setSelectedDifficulties] = useState<string[]>([
    'easy',
    'medium',
    'hard'
  ]);
  const [completedIds, setCompletedIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadCompletedState();
  }, []);

  const loadCompletedState = async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) {
        setCompletedIds(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Error loading completion state', e);
    }
  };

  const toggleCompleted = async (problemKey: string) => {
    const nextState = {
      ...completedIds,
      [problemKey]: !completedIds[problemKey]
    };
    setCompletedIds(nextState);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
    } catch (e) {
      console.error('Error saving completion state', e);
    }
  };

  const activeSheet: SheetMeta = useMemo(() => {
    return SHEETS.find((s) => s.id === selectedSheetId) || SHEETS[0];
  }, [selectedSheetId]);

  const filteredProblems = useMemo(() => {
    return activeSheet.problems.filter((p) => {
      const diff = (p.difficulty || '').toLowerCase();
      if (selectedDifficulties.length > 0 && !selectedDifficulties.includes(diff)) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const name = (p.problem_name || '').toLowerCase();
        const cat = (p.category_name || p.pattern || '').toLowerCase();
        return name.includes(q) || cat.includes(q);
      }
      return true;
    });
  }, [activeSheet, selectedDifficulties, searchQuery]);

  const completedCountInActiveSheet = useMemo(() => {
    return activeSheet.problems.filter((p) => {
      const key = `${activeSheet.id}:${p.problem_id || p.problem_name}`;
      return !!completedIds[key];
    }).length;
  }, [activeSheet, completedIds]);

  const progressPercent = useMemo(() => {
    if (activeSheet.problems.length === 0) return 0;
    return Math.round((completedCountInActiveSheet / activeSheet.problems.length) * 100);
  }, [activeSheet, completedCountInActiveSheet]);

  const toggleDifficulty = (diff: string) => {
    if (selectedDifficulties.includes(diff)) {
      if (selectedDifficulties.length === 1) return; // keep at least one
      setSelectedDifficulties(selectedDifficulties.filter((d) => d !== diff));
    } else {
      setSelectedDifficulties([...selectedDifficulties, diff]);
    }
  };

  const openUrl = async (url?: string) => {
    if (!url) return;
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch (e) {
      Alert.alert('Unable to open link', url);
    }
  };

  const pickRandomProblem = () => {
    if (filteredProblems.length === 0) return;
    const randomIdx = Math.floor(Math.random() * filteredProblems.length);
    const p = filteredProblems[randomIdx];
    Alert.alert(
      'Random Pick 🎲',
      `${p.problem_name}\n(${p.category_name || p.pattern || 'General'}) - ${p.difficulty}`,
      [
        { text: 'Close', style: 'cancel' },
        { text: 'Open LeetCode', onPress: () => openUrl(p.leetcode) }
      ]
    );
  };

  const renderProblemItem = ({ item }: { item: Problem }) => {
    const itemKey = `${activeSheet.id}:${item.problem_id || item.problem_name}`;
    const isCompleted = !!completedIds[itemKey];

    let diffColor = '#22C55E';
    if (item.difficulty.toLowerCase() === 'medium') diffColor = '#F59E0B';
    if (item.difficulty.toLowerCase() === 'hard') diffColor = '#EF4444';

    return (
      <View style={[styles.problemCard, isCompleted && styles.problemCardCompleted]}>
        <TouchableOpacity
          style={styles.checkboxTouch}
          onPress={() => toggleCompleted(itemKey)}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, isCompleted && styles.checkboxChecked]}>
            {isCompleted && <Text style={styles.checkmark}>✓</Text>}
          </View>
        </TouchableOpacity>

        <View style={styles.problemInfo}>
          <Text
            style={[styles.problemTitle, isCompleted && styles.problemTitleCompleted]}
            numberOfLines={2}
          >
            {item.problem_name}
          </Text>
          <View style={styles.badgeRow}>
            <View style={[styles.diffBadge, { backgroundColor: diffColor + '22' }]}>
              <Text style={[styles.diffText, { color: diffColor }]}>{item.difficulty}</Text>
            </View>

            {(item.category_name || item.pattern) && (
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryText} numberOfLines={1}>
                  {item.category_name || item.pattern}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.linksRow}>
            {item.leetcode && (
              <TouchableOpacity
                style={styles.linkButton}
                onPress={() => openUrl(item.leetcode)}
              >
                <Text style={styles.linkButtonText}>LeetCode ↗</Text>
              </TouchableOpacity>
            )}
            {(item.article || item.solution) && (
              <TouchableOpacity
                style={styles.linkButton}
                onPress={() => openUrl(item.article || item.solution)}
              >
                <Text style={styles.linkButtonText}>Article ↗</Text>
              </TouchableOpacity>
            )}
            {item.youtube && (
              <TouchableOpacity
                style={[styles.linkButton, styles.youtubeButton]}
                onPress={() => openUrl(item.youtube)}
              >
                <Text style={styles.youtubeButtonText}>Video ▶</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

      {/* Header & Sheet Selector Carousel */}
      <View style={styles.headerContainer}>
        <View style={styles.titleRow}>
          <Text style={styles.appMark}>DSA</Text>
          <Text style={styles.appTitle}>DSA Sheets</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sheetsScroll}
        >
          {SHEETS.map((sheet) => {
            const isSelected = sheet.id === selectedSheetId;
            return (
              <TouchableOpacity
                key={sheet.id}
                style={[styles.sheetChip, isSelected && styles.sheetChipSelected]}
                onPress={() => setSelectedSheetId(sheet.id)}
              >
                <Text
                  style={[styles.sheetChipText, isSelected && styles.sheetChipTextSelected]}
                >
                  {sheet.shortTitle}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Active Sheet Progress Card */}
        <View style={styles.progressCard}>
          <View style={styles.progressHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetTitle}>{activeSheet.title}</Text>
              <Text style={styles.sheetSubtitle}>{activeSheet.subtitle}</Text>
            </View>

            <View style={styles.statBox}>
              <Text style={styles.statValue}>
                {completedCountInActiveSheet} / {activeSheet.problems.length}
              </Text>
              <Text style={styles.statLabel}>{progressPercent}% Done</Text>
            </View>
          </View>

          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
          </View>
        </View>

        {/* Toolbar: Search, Filters & Random Pick */}
        <View style={styles.toolbarContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search problems or topics..."
            placeholderTextColor="#64748B"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />

          <View style={styles.filterRow}>
            <View style={styles.diffFilters}>
              {['easy', 'medium', 'hard'].map((diff) => {
                const active = selectedDifficulties.includes(diff);
                return (
                  <TouchableOpacity
                    key={diff}
                    style={[styles.diffChip, active && styles.diffChipActive]}
                    onPress={() => toggleDifficulty(diff)}
                  >
                    <Text
                      style={[styles.diffChipText, active && styles.diffChipTextActive]}
                    >
                      {diff.charAt(0).toUpperCase() + diff.slice(1)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity style={styles.randomButton} onPress={pickRandomProblem}>
              <Text style={styles.randomButtonText}>🎲 Pick</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Problem List */}
      <FlatList
        data={filteredProblems}
        keyExtractor={(item, index) => `${item.problem_id || item.problem_name}_${index}`}
        renderItem={renderProblemItem}
        contentContainerStyle={styles.listContent}
        initialNumToRender={15}
        maxToRenderPerBatch={20}
        windowSize={10}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No matching problems found.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A'
  },
  headerContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B'
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12
  },
  appMark: {
    backgroundColor: '#3B82F6',
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 8
  },
  appTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F8FAFC'
  },
  sheetsScroll: {
    gap: 8,
    paddingBottom: 12
  },
  sheetChip: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155'
  },
  sheetChipSelected: {
    backgroundColor: '#2563EB',
    borderColor: '#3B82F6'
  },
  sheetChipText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600'
  },
  sheetChipTextSelected: {
    color: '#FFFFFF'
  },
  progressCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155'
  },
  progressHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC'
  },
  sheetSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2
  },
  statBox: {
    alignItems: 'flex-end'
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#38BDF8'
  },
  statLabel: {
    fontSize: 11,
    color: '#64748B'
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: '#0F172A',
    borderRadius: 3,
    overflow: 'hidden'
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#38BDF8',
    borderRadius: 3
  },
  toolbarContainer: {
    gap: 8
  },
  searchInput: {
    backgroundColor: '#1E293B',
    color: '#F8FAFC',
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155'
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  diffFilters: {
    flexDirection: 'row',
    gap: 6
  },
  diffChip: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155'
  },
  diffChipActive: {
    backgroundColor: '#334155',
    borderColor: '#475569'
  },
  diffChipText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600'
  },
  diffChipTextActive: {
    color: '#F8FAFC'
  },
  randomButton: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8
  },
  randomButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700'
  },
  listContent: {
    padding: 16,
    gap: 10
  },
  problemCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#334155'
  },
  problemCardCompleted: {
    opacity: 0.65,
    backgroundColor: '#0F172A'
  },
  checkboxTouch: {
    paddingRight: 10,
    paddingTop: 2
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#64748B',
    alignItems: 'center',
    justifyContent: 'center'
  },
  checkboxChecked: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E'
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900'
  },
  problemInfo: {
    flex: 1
  },
  problemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#F8FAFC',
    marginBottom: 6
  },
  problemTitleCompleted: {
    textDecorationLine: 'line-through',
    color: '#94A3B8'
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8
  },
  diffBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6
  },
  diffText: {
    fontSize: 11,
    fontWeight: '700'
  },
  categoryBadge: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    maxWidth: 160
  },
  categoryText: {
    color: '#94A3B8',
    fontSize: 11
  },
  linksRow: {
    flexDirection: 'row',
    gap: 8
  },
  linkButton: {
    backgroundColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6
  },
  linkButtonText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '600'
  },
  youtubeButton: {
    backgroundColor: '#991B1B'
  },
  youtubeButtonText: {
    color: '#FCA5A5',
    fontSize: 11,
    fontWeight: '600'
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40
  },
  emptyText: {
    color: '#64748B',
    fontSize: 14
  }
});
