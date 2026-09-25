import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  StyleProp,
} from 'react-native';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  style,
}) => {
  const getStyles = (): { btn: ViewStyle; text: TextStyle } => {
    switch (variant) {
      case 'secondary':
        return {
          btn: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
          text: { color: '#0f172a' },
        };
      case 'danger':
        return {
          btn: { backgroundColor: '#e11d48' },
          text: { color: '#ffffff' },
        };
      case 'outline':
        return {
          btn: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: '#4f46e5' },
          text: { color: '#4f46e5' },
        };
      default:
        return {
          btn: { backgroundColor: '#4f46e5' },
          text: { color: '#ffffff' },
        };
    }
  };

  const currentStyles = getStyles();

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.button,
        size === 'sm' && styles.btnSm,
        size === 'lg' && styles.btnLg,
        currentStyles.btn,
        disabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' || variant === 'outline' ? '#4f46e5' : '#ffffff'} size="small" />
      ) : (
        <>
          {icon}
          <Text
            style={[
              styles.text,
              size === 'sm' && styles.textSm,
              size === 'lg' && styles.textLg,
              currentStyles.text,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    minHeight: 48,
    gap: 8,
  },
  btnSm: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    minHeight: 36,
    borderRadius: 8,
  },
  btnLg: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    minHeight: 52,
    borderRadius: 14,
  },
  text: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  textSm: {
    fontSize: 12,
  },
  textLg: {
    fontSize: 16,
  },
  disabled: {
    opacity: 0.5,
  },
});
