import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as ImageManipulator from "expo-image-manipulator";
import { LinearGradient } from "expo-linear-gradient";
import * as MediaLibrary from "expo-media-library";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ScrollView,
  Alert,
  Platform,
  ActivityIndicator,
  StatusBar,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons, Feather } from "@expo/vector-icons";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const IMAGE_HEIGHT = SCREEN_HEIGHT * 0.52;

type FilterName = "Normal" | "Warm" | "Cool" | "Fade" | "Drama" | "Vintage" | "Noir" | "Vivid";
type TabName = "adjust" | "filters" | "background";

interface FilterConfig {
  name: FilterName;
  overlayColor: string;
  overlayOpacity: number;
  tintColor?: string;
}

interface BackgroundOption {
  id: string;
  label: string;
  colors: string[];
}

const FILTERS: FilterConfig[] = [
  { name: "Normal", overlayColor: "transparent", overlayOpacity: 0 },
  { name: "Warm", overlayColor: "#FF8C42", overlayOpacity: 0.18 },
  { name: "Cool", overlayColor: "#4AA8FF", overlayOpacity: 0.18 },
  { name: "Fade", overlayColor: "#FFFFFF", overlayOpacity: 0.28 },
  { name: "Drama", overlayColor: "#1A0066", overlayOpacity: 0.28 },
  { name: "Vintage", overlayColor: "#8B4513", overlayOpacity: 0.22 },
  { name: "Noir", overlayColor: "#000000", overlayOpacity: 0.45 },
  { name: "Vivid", overlayColor: "#FF1493", overlayOpacity: 0.12 },
];

const BACKGROUNDS: BackgroundOption[] = [
  { id: "night", label: "Night", colors: ["#0a0a0f", "#12122a"] },
  { id: "ocean", label: "Ocean", colors: ["#0066CC", "#00CCFF"] },
  { id: "forest", label: "Forest", colors: ["#0A3622", "#1A7A3C"] },
  { id: "sunset", label: "Sunset", colors: ["#FF4500", "#FF8C00", "#FFA500"] },
  { id: "rose", label: "Rose", colors: ["#8B0A3B", "#D4547A", "#FFB6C1"] },
  { id: "cosmic", label: "Cosmic", colors: ["#0D0221", "#4B0082", "#8A2BE2"] },
  { id: "gold", label: "Gold", colors: ["#2C1A00", "#C07700", "#FFD700"] },
  { id: "ice", label: "Ice", colors: ["#0066AA", "#88CCEE", "#DDEEFF"] },
];

export default function EditScreen() {
  const { uri } = useLocalSearchParams<{ uri: string }>();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<TabName>("filters");
  const [selectedFilter, setSelectedFilter] = useState<FilterName>("Normal");
  const [selectedBg, setSelectedBg] = useState<string>("night");
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [brightness, setBrightness] = useState(0);
  const [saving, setSaving] = useState(false);
  const [mediaPermission, requestMediaPermission] = MediaLibrary.usePermissions();

  const saveScale = useSharedValue(1);

  const currentFilter = FILTERS.find((f) => f.name === selectedFilter) ?? FILTERS[0];
  const currentBg = BACKGROUNDS.find((b) => b.id === selectedBg) ?? BACKGROUNDS[0];

  const handleRotate = useCallback(() => {
    setRotation((r) => (r + 90) % 360);
    Haptics.selectionAsync();
  }, []);

  const handleFlip = useCallback(() => {
    setFlipH((f) => !f);
    Haptics.selectionAsync();
  }, []);

  const handleSave = async () => {
    if (!uri) return;
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      if (!mediaPermission?.granted) {
        const perm = await requestMediaPermission();
        if (!perm.granted) {
          Alert.alert(
            "Permission Required",
            "Allow access to your photo library to save photos."
          );
          setSaving(false);
          return;
        }
      }

      const actions: ImageManipulator.Action[] = [];
      if (rotation !== 0) {
        actions.push({ rotate: rotation });
      }
      if (flipH) {
        actions.push({ flip: ImageManipulator.FlipType.Horizontal });
      }

      let finalUri = uri;
      if (actions.length > 0) {
        const result = await ImageManipulator.manipulateAsync(uri, actions, {
          compress: 0.95,
          format: ImageManipulator.SaveFormat.JPEG,
        });
        finalUri = result.uri;
      }

      await MediaLibrary.saveToLibraryAsync(finalUri);

      const stored = await AsyncStorage.getItem("photos");
      const photos = stored ? JSON.parse(stored) : [];
      photos.unshift({ uri: finalUri, timestamp: Date.now() });
      await AsyncStorage.setItem("photos", JSON.stringify(photos.slice(0, 200)));

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Saved!", "Photo saved to your library.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e) {
      console.error("Save error:", e);
      Alert.alert("Error", "Could not save photo. Please try again.");
    }
    setSaving(false);
  };

  const saveButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: saveScale.value }],
  }));

  if (!uri) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>No photo to edit</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const imageTransform = [
    { rotate: `${rotation}deg` },
    { scaleX: flipH ? -1 : 1 },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Background */}
      <LinearGradient
        colors={currentBg.colors as [string, string, ...string[]]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.55)" }]} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="close" size={22} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Photo</Text>
        <Animated.View style={saveButtonStyle}>
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Text style={styles.saveBtnText}>Save</Text>
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* Image preview */}
      <View style={styles.imageContainer}>
        <View style={styles.imageFrame}>
          <Image
            source={{ uri }}
            style={[styles.previewImage, { transform: imageTransform }]}
            contentFit="contain"
          />
          {/* Filter overlay */}
          {currentFilter.overlayOpacity > 0 && (
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: currentFilter.overlayColor,
                  opacity: currentFilter.overlayOpacity,
                  borderRadius: 16,
                },
              ]}
              pointerEvents="none"
            />
          )}
          {/* Brightness overlay */}
          {brightness !== 0 && (
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: brightness > 0 ? "#FFFFFF" : "#000000",
                  opacity: Math.abs(brightness) * 0.4,
                  borderRadius: 16,
                },
              ]}
              pointerEvents="none"
            />
          )}
        </View>

        {/* Quick transform row */}
        <View style={styles.transformRow}>
          <TouchableOpacity onPress={handleRotate} style={styles.transformBtn}>
            <MaterialCommunityIcons name="rotate-right" size={20} color="#FFF" />
            <Text style={styles.transformBtnText}>Rotate</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleFlip} style={styles.transformBtn}>
            <MaterialCommunityIcons name="flip-horizontal" size={20} color="#FFF" />
            <Text style={styles.transformBtnText}>Flip</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setRotation(0);
              setFlipH(false);
              setBrightness(0);
              setSelectedFilter("Normal");
              Haptics.selectionAsync();
            }}
            style={styles.transformBtn}
          >
            <Ionicons name="refresh" size={20} color="#FFF" />
            <Text style={styles.transformBtnText}>Reset</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {(["filters", "adjust", "background"] as TabName[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => {
              setActiveTab(tab);
              Haptics.selectionAsync();
            }}
            style={[styles.tabItem, activeTab === tab && styles.tabItemActive]}
          >
            <Text
              style={[styles.tabText, activeTab === tab && styles.tabTextActive]}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab content */}
      <View style={[styles.tabContent, { paddingBottom: insets.bottom + 16 }]}>
        {activeTab === "filters" && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {FILTERS.map((f) => (
              <TouchableOpacity
                key={f.name}
                onPress={() => {
                  setSelectedFilter(f.name);
                  Haptics.selectionAsync();
                }}
                style={styles.filterItem}
              >
                <View
                  style={[
                    styles.filterThumb,
                    selectedFilter === f.name && styles.filterThumbActive,
                  ]}
                >
                  <Image
                    source={{ uri }}
                    style={styles.filterThumbImg}
                    contentFit="cover"
                  />
                  {f.overlayOpacity > 0 && (
                    <View
                      style={[
                        StyleSheet.absoluteFill,
                        {
                          backgroundColor: f.overlayColor,
                          opacity: f.overlayOpacity,
                          borderRadius: 10,
                        },
                      ]}
                    />
                  )}
                </View>
                <Text
                  style={[
                    styles.filterLabel,
                    selectedFilter === f.name && styles.filterLabelActive,
                  ]}
                >
                  {f.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {activeTab === "adjust" && (
          <View style={styles.adjustContainer}>
            <AdjustSlider
              label="Brightness"
              value={brightness}
              onValueChange={setBrightness}
              min={-1}
              max={1}
              icon="sunny-outline"
            />
          </View>
        )}

        {activeTab === "background" && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.bgRow}
          >
            {BACKGROUNDS.map((bg) => (
              <TouchableOpacity
                key={bg.id}
                onPress={() => {
                  setSelectedBg(bg.id);
                  Haptics.selectionAsync();
                }}
                style={styles.bgItem}
              >
                <LinearGradient
                  colors={bg.colors as [string, string, ...string[]]}
                  style={[
                    styles.bgSwatch,
                    selectedBg === bg.id && styles.bgSwatchActive,
                  ]}
                />
                <Text
                  style={[
                    styles.bgLabel,
                    selectedBg === bg.id && styles.bgLabelActive,
                  ]}
                >
                  {bg.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

interface AdjustSliderProps {
  label: string;
  value: number;
  onValueChange: (v: number) => void;
  min: number;
  max: number;
  icon: string;
}

function AdjustSlider({ label, value, onValueChange, min, max, icon }: AdjustSliderProps) {
  const TRACK_WIDTH = SCREEN_WIDTH - 80;
  const thumbPos = ((value - min) / (max - min)) * TRACK_WIDTH;

  const panResponder = require("react-native").PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {},
    onPanResponderMove: (_, gs) => {
      const newPos = Math.max(0, Math.min(TRACK_WIDTH, thumbPos + gs.dx));
      const newVal = min + (newPos / TRACK_WIDTH) * (max - min);
      onValueChange(newVal);
    },
  });

  return (
    <View style={sliderStyles.container}>
      <View style={sliderStyles.labelRow}>
        <Ionicons name={icon as "sunny-outline"} size={18} color="#7777AA" />
        <Text style={sliderStyles.label}>{label}</Text>
        <Text style={sliderStyles.value}>{Math.round(value * 100)}</Text>
      </View>
      <View style={sliderStyles.trackContainer} {...panResponder.panHandlers}>
        <View style={sliderStyles.track}>
          <View style={[sliderStyles.fill, { width: thumbPos }]} />
        </View>
        <View style={[sliderStyles.thumb, { left: thumbPos - 12 }]} />
      </View>
    </View>
  );
}

const sliderStyles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    gap: 12,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  label: {
    color: "#FFF",
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },
  value: {
    color: "#00D4FF",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    minWidth: 36,
    textAlign: "right",
  },
  trackContainer: {
    height: 40,
    justifyContent: "center",
    position: "relative",
  },
  track: {
    height: 4,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 2,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    backgroundColor: "#00D4FF",
  },
  thumb: {
    position: "absolute",
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FFF",
    top: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#080810",
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#080810",
    gap: 16,
  },
  errorText: {
    color: "#FFF",
    fontSize: 18,
    fontFamily: "Inter_500Medium",
  },
  backButton: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    backgroundColor: "#00D4FF",
    borderRadius: 24,
  },
  backButtonText: {
    color: "#000",
    fontFamily: "Inter_600SemiBold",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
    zIndex: 10,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: "#FFF",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  saveBtn: {
    backgroundColor: "#00D4FF",
    paddingHorizontal: 22,
    paddingVertical: 9,
    borderRadius: 22,
    minWidth: 70,
    alignItems: "center",
  },
  saveBtnText: {
    color: "#000",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  imageContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    gap: 12,
  },
  imageFrame: {
    width: SCREEN_WIDTH - 40,
    height: IMAGE_HEIGHT,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  transformRow: {
    flexDirection: "row",
    gap: 12,
  },
  transformBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  transformBtnText: {
    color: "#FFF",
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  tabBar: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  tabItemActive: {
    borderBottomWidth: 2,
    borderBottomColor: "#00D4FF",
  },
  tabText: {
    color: "#7777AA",
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  tabTextActive: {
    color: "#00D4FF",
    fontFamily: "Inter_600SemiBold",
  },
  tabContent: {
    minHeight: 120,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  filterRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    flexDirection: "row",
  },
  filterItem: {
    alignItems: "center",
    gap: 6,
  },
  filterThumb: {
    width: 64,
    height: 64,
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
  },
  filterThumbActive: {
    borderColor: "#00D4FF",
  },
  filterThumbImg: {
    width: "100%",
    height: "100%",
  },
  filterLabel: {
    color: "#7777AA",
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  filterLabelActive: {
    color: "#00D4FF",
  },
  adjustContainer: {
    paddingVertical: 16,
    gap: 8,
  },
  bgRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    flexDirection: "row",
  },
  bgItem: {
    alignItems: "center",
    gap: 6,
  },
  bgSwatch: {
    width: 64,
    height: 64,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "transparent",
  },
  bgSwatchActive: {
    borderColor: "#00D4FF",
  },
  bgLabel: {
    color: "#7777AA",
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  bgLabelActive: {
    color: "#00D4FF",
  },
});
