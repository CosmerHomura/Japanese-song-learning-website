import { useEffect, useRef, useState } from 'react';
import { updateLocalSongMetadata } from '../lib/localSongStore';
import { loadApplicationData } from '../lib/applicationRepository';
import { findArtworkWithRetry } from '../lib/songHelpers';
export default function useLocalLibrary({} = {}) {
  const [libraryReady, setLibraryReady] = useState(false);
  const [libraryError, setLibraryError] = useState('');
  const [localSongs, setLocalSongs] = useState([]);
  const [localAudioUrls, setLocalAudioUrls] = useState({});
  const [deletingSongId, setDeletingSongId] = useState('');
  const localAudioUrlRef = useRef({});
  const artworkLookupRef = useRef(new Set());
  useEffect(() => {
    let disposed = false;
    loadApplicationData().then(({
      songs: records
    }) => {
      const nextUrls = {};
      records.forEach(record => {
        nextUrls[record.id] = URL.createObjectURL(record.audioBlob);
      });
      if (disposed) {
        Object.values(nextUrls).forEach(url => URL.revokeObjectURL(url));
        return;
      }
      localAudioUrlRef.current = nextUrls;
      setLocalAudioUrls(nextUrls);
      setLocalSongs(records.map(({
        audioBlob,
        ...song
      }) => song));
      setLibraryReady(true);
    }).catch(error => {
      if (!disposed) setLibraryError(error.message || '无法读取歌曲库，请重新打开应用。');
    });
    return () => {
      disposed = true;
    };
  }, []);
  useEffect(() => () => {
    Object.values(localAudioUrlRef.current).forEach(url => URL.revokeObjectURL(url));
  }, []);
  useEffect(() => {
    const missingArtwork = localSongs.filter(song => song.isLocal && !song.artworkUrl && song.title && !artworkLookupRef.current.has(song.id));
    missingArtwork.forEach(song => {
      artworkLookupRef.current.add(song.id);
      findArtworkWithRetry(song.title, song.artist).then(async artwork => {
        if (!artwork) return;
        await updateLocalSongMetadata(song.id, artwork);
        setLocalSongs(previous => previous.map(item => item.id === song.id ? {
          ...item,
          ...artwork
        } : item));
      }).catch(() => {/* The fallback card remains usable if online lookup fails. */});
    });
  }, [localSongs]);
  return {
    localSongs,
    setLocalSongs,
    localAudioUrls,
    setLocalAudioUrls,
    deletingSongId,
    setDeletingSongId,
    localAudioUrlRef,
    libraryReady,
    libraryError
  };
}
