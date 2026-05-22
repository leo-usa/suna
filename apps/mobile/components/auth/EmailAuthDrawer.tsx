import * as React from 'react';
import { View, TextInput, Keyboard, Platform } from 'react-native';
import { BottomSheetModal, BottomSheetScrollView, BottomSheetBackdrop, TouchableOpacity as BottomSheetTouchable } from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mail, ArrowRight, X, Check } from 'lucide-react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { openInbox } from 'react-native-email-link';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts';
import * as Haptics from 'expo-haptics';
import { useToast } from '@/components/ui/toast-provider';
import { log } from '@/lib/logger';

export interface EmailAuthDrawerRef {
  open: () => void;
  close: () => void;
}

type LoginMethod = 'magic_link' | 'password';

const MIN_PASSWORD_LENGTH = 6;

/**
 * EmailAuthDrawer — magic link or email/password (same options as web /auth/password).
 */
export const EmailAuthDrawer = React.forwardRef<EmailAuthDrawerRef, {
  onSuccess?: () => void;
}>(({ onSuccess }, ref) => {
  const bottomSheetRef = React.useRef<BottomSheetModal>(null);
  const { t } = useLanguage();
  const { colorScheme } = useColorScheme();
  const { signInWithMagicLink, signIn, signUp, isLoading } = useAuth();
  const toast = useToast();
  const insets = useSafeAreaInsets();

  const [emailSent, setEmailSent] = React.useState(false);
  const [loginMethod, setLoginMethod] = React.useState<LoginMethod>('magic_link');
  const [isSignUp, setIsSignUp] = React.useState(false);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [acceptedTerms, setAcceptedTerms] = React.useState(false);
  const emailInputRef = React.useRef<TextInput | null>(null);

  const isDark = colorScheme === 'dark';

  React.useImperativeHandle(ref, () => ({
    open: () => {
      bottomSheetRef.current?.present();
      setTimeout(() => {
        emailInputRef.current?.focus();
      }, 400);
    },
    close: () => {
      bottomSheetRef.current?.dismiss();
    },
  }));

  const snapPoints = React.useMemo(() => ['90%'], []);

  const renderBackdrop = React.useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
        pressBehavior="close"
        onPress={() => Keyboard.dismiss()}
      />
    ),
    []
  );

  const resetForm = () => {
    setEmailSent(false);
    setLoginMethod('magic_link');
    setIsSignUp(false);
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setAcceptedTerms(false);
  };

  const handleSendMagicLink = async () => {
    if (!email || !email.includes('@')) {
      toast.error(t('auth.validationErrors.emailRequired'));
      return;
    }

    if (!acceptedTerms) {
      toast.error(t('auth.termsRequired'));
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const result = await signInWithMagicLink({ email, acceptedTerms });

    if (result.success) {
      setEmailSent(true);
      Keyboard.dismiss();
      emailInputRef.current?.blur();
    } else {
      toast.error(result.error?.message || t('auth.magicLinkFailed'));
    }
  };

  const handlePasswordAuth = async () => {
    if (!email || !email.includes('@')) {
      toast.error(t('auth.validationErrors.emailRequired'));
      return;
    }

    if (!password || password.length < MIN_PASSWORD_LENGTH) {
      toast.error(t('auth.passwordTooShort'));
      return;
    }

    if (isSignUp && password !== confirmPassword) {
      toast.error(t('auth.passwordsDontMatch'));
      return;
    }

    if (!acceptedTerms) {
      toast.error(t('auth.termsRequired'));
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const result = isSignUp
      ? await signUp({ email, password })
      : await signIn({ email, password });

    if (result.success) {
      if (result.data?.session) {
        bottomSheetRef.current?.dismiss();
        onSuccess?.();
      } else if (isSignUp) {
        toast.success(t('auth.verifyEmailInstructions'));
        bottomSheetRef.current?.dismiss();
      } else {
        bottomSheetRef.current?.dismiss();
        onSuccess?.();
      }
      return;
    }

    toast.error(
      result.error?.message ||
        (isSignUp ? t('auth.signUpFailed') : t('auth.signInFailed'))
    );
  };

  const handleDismiss = () => {
    Keyboard.dismiss();
    resetForm();
  };

  const handleSheetChange = React.useCallback((index: number) => {
    if (index === -1) {
      Keyboard.dismiss();
    }
  }, []);

  const isValidEmail = email.includes('@') && email.length > 3;
  const canSubmitPassword =
    isValidEmail &&
    password.length >= MIN_PASSWORD_LENGTH &&
    acceptedTerms &&
    (!isSignUp || password === confirmPassword);

  const switchToPassword = () => {
    setLoginMethod('password');
    setEmailSent(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const switchToMagicLink = () => {
    setLoginMethod('magic_link');
    setIsSignUp(false);
    setPassword('');
    setConfirmPassword('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const termsCheckbox = (
    <View className="flex-row items-start">
      <BottomSheetTouchable
        onPress={() => {
          setAcceptedTerms(!acceptedTerms);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }}
        style={{ marginRight: 12, marginTop: 2 }}
      >
        <View
          style={{
            width: 20,
            height: 20,
            borderRadius: 6,
            borderWidth: 1,
            borderColor: acceptedTerms ? (isDark ? '#FFFFFF' : '#000000') : isDark ? '#454444' : '#c2c2c2',
            backgroundColor: acceptedTerms ? (isDark ? '#FFFFFF' : '#000000') : 'transparent',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          {acceptedTerms && (
            <Icon as={Check} size={16} color={isDark ? '#000000' : '#FFFFFF'} />
          )}
        </View>
      </BottomSheetTouchable>

      <View className="flex-1 flex-row flex-wrap">
        <Text className="text-[14px] font-roobert text-muted-foreground leading-5">
          {t('auth.agreeTerms')}{' '}
        </Text>
        <BottomSheetTouchable
          onPress={async () => {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            const WebBrowser = await import('expo-web-browser');
            await WebBrowser.openBrowserAsync('https://www.dobby.now/legal?tab=terms', {
              presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
              controlsColor: isDark ? '#FFFFFF' : '#000000',
            });
          }}
        >
          <Text className="text-[14px] font-roobert text-foreground leading-5 underline">
            {t('auth.userTerms')}
          </Text>
        </BottomSheetTouchable>
        <Text className="text-[14px] font-roobert text-muted-foreground leading-5">
          {' '}{t('auth.and')}{' '}
        </Text>
        <BottomSheetTouchable
          onPress={async () => {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            const WebBrowser = await import('expo-web-browser');
            await WebBrowser.openBrowserAsync('https://www.dobby.now/legal?tab=privacy', {
              presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
              controlsColor: isDark ? '#FFFFFF' : '#000000',
            });
          }}
        >
          <Text className="text-[14px] font-roobert text-foreground leading-5 underline">
            {t('auth.privacyNotice')}
          </Text>
        </BottomSheetTouchable>
      </View>
    </View>
  );

  const signInSignUpToggle = (
    <View
      className="flex-row rounded-full p-1 self-start"
      style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}
    >
      <BottomSheetTouchable
        onPress={() => {
          setIsSignUp(false);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }}
        className="px-5 py-2 rounded-full"
        style={
          !isSignUp
            ? { backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF' }
            : undefined
        }
      >
        <Text
          className={`text-[14px] font-roobert-medium ${
            !isSignUp ? 'text-foreground' : 'text-muted-foreground'
          }`}
        >
          {t('auth.signIn')}
        </Text>
      </BottomSheetTouchable>
      <BottomSheetTouchable
        onPress={() => {
          setIsSignUp(true);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }}
        className="px-5 py-2 rounded-full"
        style={
          isSignUp
            ? { backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF' }
            : undefined
        }
      >
        <Text
          className={`text-[14px] font-roobert-medium ${
            isSignUp ? 'text-foreground' : 'text-muted-foreground'
          }`}
        >
          {t('auth.signUp')}
        </Text>
      </BottomSheetTouchable>
    </View>
  );

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      index={0}
      snapPoints={snapPoints}
      onChange={handleSheetChange}
      backdropComponent={renderBackdrop}
      enablePanDownToClose
      onDismiss={handleDismiss}
      enableDynamicSizing={false}
      animateOnMount={true}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      backgroundStyle={{
        backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
      }}
      handleIndicatorStyle={{
        backgroundColor: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
      }}
    >
      <BottomSheetScrollView
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: 24,
          paddingBottom: Math.max(insets.bottom, 20) + 16,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View className="flex-1">
          {emailSent ? (
            <View className="gap-6">
              <View className="flex-row items-center justify-end">
                <BottomSheetTouchable onPress={() => bottomSheetRef.current?.dismiss()}>
                  <Icon as={X} size={24} className="text-muted-foreground" />
                </BottomSheetTouchable>
              </View>

              <View className="items-center gap-5">
                <View className="size-16 rounded-full bg-primary/10 items-center justify-center">
                  <Icon as={Mail} size={32} className="text-primary" />
                </View>

                <View className="gap-3">
                  <Text className="text-2xl font-roobert-semibold text-foreground text-center">
                    {t('auth.checkYourEmail')}
                  </Text>

                  <Text className="text-[15px] font-roobert text-muted-foreground text-center px-4">
                    {t('auth.magicLinkSent')}{'\n\n'}
                    <Text className="font-roobert-medium text-foreground">{email}</Text>
                  </Text>
                </View>
              </View>

              <View className="w-full gap-3">
                {Platform.OS === 'ios' && (
                  <Button
                    variant="outline"
                    size="lg"
                    onPress={async () => {
                      try {
                        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        await openInbox({});
                      } catch (error) {
                        log.error('Failed to open email app:', error);
                      }
                    }}
                    className="flex-row items-center justify-center gap-2"
                  >
                    <Icon as={Mail} size={20} className="text-foreground" strokeWidth={2.5} />
                    <Text className="text-foreground text-[16px] font-roobert-medium">
                      {t('auth.openEmailAppBtn')}
                    </Text>
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="lg"
                  onPress={async () => {
                    try {
                      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      await openInbox({ app: 'gmail' });
                    } catch (error) {
                      log.error('Failed to open Gmail:', error);
                    }
                  }}
                  className="flex-row items-center justify-center gap-2"
                >
                  <MaterialCommunityIcons
                    name="gmail"
                    size={22}
                    color={isDark ? '#FFFFFF' : '#000000'}
                  />
                  <Text className="text-foreground text-[16px] font-roobert-medium">
                    {t('auth.openGmailBtn')}
                  </Text>
                </Button>

                <Button
                  variant="ghost"
                  size="lg"
                  onPress={handleSendMagicLink}
                  disabled={isLoading}
                  className="flex-row items-center justify-center gap-2"
                >
                  <Text className="text-muted-foreground text-[16px] font-roobert">
                    {isLoading ? t('auth.sending') : t('auth.resendLink')}
                  </Text>
                </Button>
              </View>
            </View>
          ) : loginMethod === 'password' ? (
            <View className="gap-5">
              <View className="flex-row items-center justify-end">
                <BottomSheetTouchable onPress={() => bottomSheetRef.current?.dismiss()}>
                  <Icon as={X} size={24} className="text-muted-foreground" />
                </BottomSheetTouchable>
              </View>

              <View className="gap-3">
                {signInSignUpToggle}
                <Text className="text-[28px] font-roobert-semibold text-foreground leading-tight">
                  {isSignUp ? t('auth.createAccount') : t('auth.signIn')}
                </Text>
                <Text className="text-[15px] font-roobert text-muted-foreground">
                  {isSignUp
                    ? t('auth.passwordSignUpDescription')
                    : t('auth.passwordSignInDescription')}
                </Text>
              </View>

              <Input
                ref={emailInputRef}
                value={email}
                onChangeText={(text) => setEmail(text.trim().toLowerCase())}
                placeholder={t('auth.emailPlaceholder')}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                returnKeyType="next"
                size="lg"
                wrapperClassName="bg-muted/10 dark:bg-muted/30"
              />

              <Input
                value={password}
                onChangeText={setPassword}
                placeholder={t('auth.passwordPlaceholder')}
                secureTextEntry
                autoCapitalize="none"
                autoComplete={isSignUp ? 'new-password' : 'password'}
                returnKeyType={isSignUp ? 'next' : 'go'}
                onSubmitEditing={isSignUp ? undefined : handlePasswordAuth}
                size="lg"
                wrapperClassName="bg-muted/10 dark:bg-muted/30"
              />

              {isSignUp && (
                <Input
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder={t('auth.confirmPasswordPlaceholder')}
                  secureTextEntry
                  autoCapitalize="none"
                  autoComplete="new-password"
                  returnKeyType="go"
                  onSubmitEditing={handlePasswordAuth}
                  size="lg"
                  wrapperClassName="bg-muted/10 dark:bg-muted/30"
                />
              )}

              {termsCheckbox}

              <Button
                variant="default"
                size="lg"
                onPress={handlePasswordAuth}
                disabled={isLoading || !canSubmitPassword}
              >
                <Text className="text-[16px] font-roobert-medium text-primary-foreground">
                  {isLoading
                    ? isSignUp
                      ? t('auth.creatingAccount')
                      : t('auth.signingIn')
                    : isSignUp
                      ? t('auth.createAccount')
                      : t('auth.signIn')}
                </Text>
                {!isLoading && (
                  <Icon as={ArrowRight} size={16} className="text-primary-foreground" />
                )}
              </Button>

              <BottomSheetTouchable onPress={switchToMagicLink} className="py-2">
                <Text className="text-[14px] font-roobert-medium text-primary text-center">
                  {t('auth.useMagicLinkInstead')}
                </Text>
              </BottomSheetTouchable>
            </View>
          ) : (
            <View className="gap-6">
              <View className="flex-row items-center justify-end">
                <BottomSheetTouchable onPress={() => bottomSheetRef.current?.dismiss()}>
                  <Icon as={X} size={24} className="text-muted-foreground" />
                </BottomSheetTouchable>
              </View>

              <View className="gap-4">
                <Text className="text-[28px] font-roobert-semibold text-foreground leading-tight">
                  {t('auth.continueWithEmail')}
                </Text>
                <Text className="text-[15px] font-roobert text-muted-foreground">
                  {t('auth.magicLinkDescription')}
                </Text>
              </View>

              <Input
                ref={emailInputRef}
                value={email}
                onChangeText={(text) => setEmail(text.trim().toLowerCase())}
                placeholder={t('auth.emailPlaceholder')}
                keyboardType="email-address"
                returnKeyType="go"
                onSubmitEditing={handleSendMagicLink}
                size="lg"
                wrapperClassName="bg-muted/10 dark:bg-muted/30"
              />

              {termsCheckbox}

              <Button
                variant="default"
                size="lg"
                onPress={handleSendMagicLink}
                disabled={isLoading || !isValidEmail || !acceptedTerms}
              >
                <Text className="text-[16px] font-roobert-medium text-primary-foreground">
                  {isLoading ? t('auth.sending') : t('auth.sendMagicLink')}
                </Text>
                {!isLoading && (
                  <Icon as={ArrowRight} size={16} className="text-primary-foreground" />
                )}
              </Button>

              <BottomSheetTouchable onPress={switchToPassword} className="py-2">
                <Text className="text-[14px] font-roobert-medium text-primary text-center">
                  {t('auth.signInWithPassword')}
                </Text>
              </BottomSheetTouchable>
            </View>
          )}
        </View>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
});

EmailAuthDrawer.displayName = 'EmailAuthDrawer';
