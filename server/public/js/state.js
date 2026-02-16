/**
 * 全局状态管理
 */

export const state = {
  selectedVideoFile: null,
  currentBatchId: null,
  pollTimer: null,
  currentFestival: "spring",

  // 录制相关
  cameraStream: null,
  mediaRecorder: null,
  recordedChunks: [],
  recordStartTime: null,
  recordTimerInterval: null,
  currentVideoMode: "record",

  // 音频录制相关
  audioRecordEnabled: false,
  selectedAudioFile: null,
  audioStream: null,
  audioRecorder: null,
  audioChunks: [],
  audioRecordStartTime: null,
  audioTimerInterval: null,
  audioAnalyser: null,
  audioAnimFrame: null,

  // 收信人列表
  recipientCount: 0,

  // 台词预览
  previewData: null,
  countdownTimer: null,
  countdownRemaining: 0,
  countdownTotal: 0,
  countdownPaused: false,

  // 防重复
  isConfirming: false,
};
