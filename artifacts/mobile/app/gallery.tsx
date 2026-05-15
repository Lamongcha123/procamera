import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as MediaLibrary from "expo-media-library";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Dimensions,
  Alert,
  StatusBar,
  Modal,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, Feather } from "@expo/vector-icons";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const ITEM_SIZE = (SCREEN_WIDTH - 4) / 3;

interface PhotoEntry {
  uri: string;
  timestamp: number;
}

function PhotoGridItem({
  item,
  onPress,
  onLongPress,
}: {
  item: PhotoEntry;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[{ width: ITEM_SIZE, height: ITEM_SIZE }, animStyle]}>
      <TouchableOpacity
        onPress={onPress}
        onLongPress={() => {
          scale.value = withSpring(0.9, {}, () => {
            scale.value = withSpring(1);
          });
          onLongPress();
        }}
        style={styles.gridItem}
        activeOpacity={0.85}
      >
        <Image
          source={{ uri: item.uri }}
          style={styles.gridImage}
          contentFit="cover"
          transition={200}
        />
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function GalleryScreen() {
  const insets = useSafeAreaInsets();
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);
  const [mediaPermission, requestMediaPermission] = MediaLibrary.usePermissions();

  const loadPhotos = useCallback(async () => {
    const stored = await AsyncStorage.getItem("photos");
    if (stored) {
      setPhotos(JSON.parse(stored));
    }
  }, []);

  useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);

  const handleDelete = (uri: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert("Delete Photo", "Remove this photo from the app?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const updated = photos.filter((p) => p.uri !== uri);
          setPhotos(updated);
          await AsyncStorage.setItem("photos", JSON.stringify(updated));
          if (viewingPhoto === uri) setViewingPhoto(null);
        },
      },
    ]);
  };

  const handleSaveToLibrary = async (uri: string) => {
    if (!mediaPermission?.granted) {
      const perm = await requestMediaPermission();
      if (!perm.granted) {
        Alert.alert("Permission Required", "Allow access to save photos to your library.");
        return;
      }
    }
    try {
      await MediaLibrary.saveToLibraryAsync(uri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Saved!", "Photo saved to your library.");
    } catch (e) {
      Alert.alert("Error", "Could not save photo.");
    }
  };

  const renderItem = useCallback(
    ({ item }: { item: PhotoEntry }) => (
      <PhotoGridItem
        item={item}
        onPress={() => setViewingPhoto(item.uri)}
        onLongPress={() => handleDelete(item.uri)}
      />
    ),
    [photos]
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={["#080810", "#0f0f1e"]} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gallery</Text>
        <View style={styles.headerRight}>
          <Text style={styles.photoCount}>{photos.length}</Text>
        </View>
      </View>

      {/* Grid */}
      {photos.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconBg}>
            <Ionicons name="camera-outline" size={48} color="#00D4FF" />
          </View>
          <Text style={styles.emptyTitle}>No Photos Yet</Text>
          <Text style={styles.emptyText}>
            Take your first photo with the 120× zoom camera
          </Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.emptyButton}>
            <Text style={styles.emptyButtonText}>Open Camera</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={photos}
          renderItem={renderItem}
          keyExtractor={(item) => item.uri + item.timestamp}
          numColumns={3}
          contentContainerStyle={styles.grid}
          ItemSeparatorComponent={() => <View style={{ height: 2 }} />}
          columnWrapperStyle={{ gap: 2 }}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!!photos.length}
        />
      )}

      {/* Full screen viewer */}
      <Modal
        visible={!!viewingPhoto}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setViewingPhoto(null)}
      >
        <View style={styles.viewer}>
          <StatusBar hidden />
          <LinearGradient colors={["#000000", "#080810"]} style={StyleSheet.absoluteFill} />
          {viewingPhoto && (
            <Image
              source={{ uri: viewingPhoto }}
              style={styles.viewerImage}
              contentFit="contain"
            />
          )}
          {/* Viewer header */}
          <View style={[styles.viewerHeader, { paddingTop: insets.top + 12 }]}>
            <TouchableOpacity
              onPress={() => setViewingPhoto(null)}
              style={styles.viewerBtn}
            >
              <Ionicons name="close" size={22} color="#FFF" />
            </TouchableOpacity>
            <View style={styles.viewerActions}>
              <TouchableOpacity
                onPress={() => {
                  if (viewingPhoto) {
                    router.push({ pathname: "/edit", params: { uri: viewingPhoto } });
                    setViewingPhoto(null);
                  }
                }}
                style={styles.viewerBtn}
              >
                <Feather name="edit-2" size={20} color="#FFF" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => viewingPhoto && handleSaveToLibrary(viewingPhoto)}
                style={styles.viewerBtn}
              >
                <Ionicons name="download-outline" size={22} color="#FFF" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => viewingPhoto && handleDelete(viewingPhoto)}
                style={styles.viewerBtn}
              >
                <Ionicons name="trash-outline" size={22} color="#FF4444" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#080810",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: "#FFF",
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  headerRight: {
    width: 40,
    alignItems: "center",
  },
  photoCount: {
    color: "#7777AA",
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  grid: {
    paddingHorizontal: 0,
  },
  gridItem: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    backgroundColor: "#12121E",
  },
  gridImage: {
    width: "100%",
    height: "100%",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingHorizontal: 40,
  },
  emptyIconBg: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "rgba(0,212,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: {
    color: "#FFF",
    fontSize: 22,
    fontFamily: "Inter_700Bold",
  },
  emptyText: {
    color: "#7777AA",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 22,
    fontFamily: "Inter_400Regular",
  },
  emptyButton: {
    backgroundColor: "#00D4FF",
    paddingHorizontal: 32,
    paddingVertical: 13,
    borderRadius: 26,
    marginTop: 8,
  },
  emptyButtonText: {
    color: "#000",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  viewer: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
  },
  viewerImage: {
    width: "100%",
    height: "100%",
  },
  viewerHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  viewerBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  viewerActions: {
    flexDirection: "row",
    gap: 8,
  },
});
