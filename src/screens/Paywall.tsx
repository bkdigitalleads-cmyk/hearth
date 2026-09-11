import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import { useTheme, fonts } from '../theme';
import { PillButton } from '../components';
import { useApp } from '../state';
import {
  getOffering,
  purchasePackage,
  restorePurchases,
  isBillingAvailable,
} from '../purchases';

const FEATURES: { icon: string; title: string; sub: string }[] = [
  { icon: '📚', title: 'Unlimited entries', sub: 'Free logs your first 14 lessons. Pro covers the whole school year, every student.' },
  { icon: '📄', title: 'Attendance & hours PDF', sub: 'Days, hours, subjects, totals against your state target, and a signature line.' },
  { icon: '🗂️', title: 'Portfolio PDF', sub: 'Every lesson with notes and work-sample photos, in date order.' },
  { icon: '🧾', title: 'CSV export', sub: 'Every entry as a spreadsheet, yours to keep.' },
  { icon: '🔒', title: 'Face ID lock', sub: 'Your family\'s records stay your business.' },
];

const TERMS_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

export default function PaywallModal({ privacyUrl }: { privacyUrl: string }) {
  const theme = useTheme();
  const { paywallVisible, hidePaywall, setIsPro } = useApp();
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [selected, setSelected] = useState<PurchasesPackage | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    if (!paywallVisible) return;
    setLoading(true);
    (async () => {
      const off = await getOffering();
      setOffering(off);
      // Homeschool families keep records for years, so the one-time Lifetime
      // purchase is the hero and default; the yearly subscription is the
      // anchor for families trying a single school year. The 14-entry free
      // tier is the funnel, so there's no separate time-limited trial.
      const lifetime =
        off?.lifetime ?? off?.annual ?? off?.availablePackages?.[0] ?? null;
      setSelected(lifetime);
      setLoading(false);
    })();
  }, [paywallVisible]);

  const buy = async () => {
    if (!selected) return;
    setPurchasing(true);
    const res = await purchasePackage(selected);
    setPurchasing(false);
    if (res.ok && res.isPro) {
      setIsPro(true);
      hidePaywall();
      Alert.alert('Welcome to Pro ✨', 'Every school day counts now — all year, every student.');
    } else if (!res.userCancelled && res.error) {
      Alert.alert('Purchase failed', res.error);
    }
  };

  const onRestore = async () => {
    if (restoring) return;
    setRestoring(true);
    const res = await restorePurchases();
    setRestoring(false);
    if (res.ok && res.isPro) {
      setIsPro(true);
      hidePaywall();
      Alert.alert('Restored', 'Your Hearth Pro purchase is active again.');
    } else if (res.ok) {
      Alert.alert(
        'No purchases found',
        'We couldn’t find a previous Hearth Pro purchase on this Apple ID.',
      );
    } else {
      Alert.alert('Restore failed', res.error ?? 'Please try again.');
    }
  };

  // Lifetime is the hero — show it first.
  const rank = (p: PurchasesPackage) =>
    p.packageType === 'LIFETIME' ? 0 : p.packageType === 'ANNUAL' ? 1 : 2;
  const packages = [...(offering?.availablePackages ?? [])].sort(
    (a, b) => rank(a) - rank(b),
  );

  // Localized prices for the always-visible disclosure below. They are blank
  // until StoreKit answers — the disclosure still renders without them.
  const lifetimePrice = packages.find((p) => p.packageType === 'LIFETIME')?.product
    .priceString;
  const annualPrice = packages.find((p) => p.packageType === 'ANNUAL')?.product
    .priceString;

  return (
    <Modal
      visible={paywallVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={hidePaywall}
    >
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Pressable onPress={hidePaywall} hitSlop={12} style={styles.close}>
            <Text style={[styles.closeText, { color: theme.textFaint }]}>✕</Text>
          </Pressable>

          <Text style={[styles.title, { color: theme.text }]}>
            Records ready{'\n'}before anyone asks
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Log every lesson, watch your days and hours fill up, and hand your
            district or evaluator a clean attendance log and portfolio in one tap.
          </Text>

          <View style={styles.features}>
            {FEATURES.map((f) => (
              <View key={f.title} style={styles.feature}>
                <Text style={styles.featureIcon}>{f.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.featureTitle, { color: theme.text }]}>{f.title}</Text>
                  <Text style={[styles.featureSub, { color: theme.textSecondary }]}>
                    {f.sub}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {loading ? (
            <ActivityIndicator style={{ marginVertical: 24 }} color={theme.accent} />
          ) : packages.length === 0 || !isBillingAvailable() ? (
            <Text style={[styles.unavailable, { color: theme.textSecondary }]}>
              Purchases aren’t available right now. Please try again later.
            </Text>
          ) : (
            <View style={styles.packages}>
              {packages.map((p) => {
                const active = selected?.identifier === p.identifier;
                const isAnnual = p.packageType === 'ANNUAL';
                const isLifetime = p.packageType === 'LIFETIME';
                const monthly =
                  isAnnual && p.product.price
                    ? `just ${(p.product.price / 12).toLocaleString(undefined, {
                        style: 'currency',
                        currency: p.product.currencyCode ?? 'USD',
                      })}/month`
                    : null;
                return (
                  <Pressable
                    key={p.identifier}
                    onPress={() => setSelected(p)}
                    style={[
                      styles.pkg,
                      {
                        borderColor: active ? theme.accent : theme.border,
                        backgroundColor: active ? theme.accentSoft : theme.card,
                      },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.pkgTitle, { color: theme.text }]}>
                        {isAnnual ? 'Yearly' : isLifetime ? 'Lifetime' : p.product.title}
                      </Text>
                      {isLifetime && (
                        <Text style={[styles.pkgBadge, { color: theme.accent }]}>
                          Best value · pay once, keep forever
                        </Text>
                      )}
                      {isAnnual && (
                        <Text style={[styles.pkgBadge, { color: theme.textSecondary }]}>
                          {monthly ? `Or ${monthly}, billed yearly` : 'Or billed yearly'}
                        </Text>
                      )}
                    </View>
                    <Text style={[styles.pkgPrice, { color: theme.text }]}>
                      {p.product.priceString}
                      <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
                        {isAnnual ? '/yr' : isLifetime ? '' : '/mo'}
                      </Text>
                    </Text>
                  </Pressable>
                );
              })}
              <PillButton
                theme={theme}
                label={purchasing ? 'One moment…' : 'Continue'}
                onPress={buy}
                disabled={purchasing || !selected}
              />
              {selected?.packageType === 'LIFETIME' && (
                <Text style={[styles.noPayment, { color: theme.success }]}>
                  ✓ One-time purchase — no subscription
                </Text>
              )}
            </View>
          )}
        </ScrollView>

        {/*
          App Review guideline 3.1.2(c): the subscription's title, length, price
          and functional Terms of Use (EULA) + Privacy Policy links must be in
          the app itself. This block sits OUTSIDE the ScrollView and OUTSIDE the
          "offering loaded" branch on purpose — it stays on screen without
          scrolling and still renders if StoreKit returns no products.
        */}
        <View
          style={[
            styles.legal,
            { borderTopColor: theme.border, backgroundColor: theme.bg },
          ]}
        >
          <Text style={[styles.legalText, { color: theme.textSecondary }]}>
            Hearth Pro — Lifetime{lifetimePrice ? ` ${lifetimePrice}` : ''}, a
            one-time purchase; or Yearly{annualPrice ? ` ${annualPrice}` : ''}, an
            auto-renewing subscription billed once per year until cancelled.
            Cancel anytime in your Apple ID settings.
          </Text>
          <View style={styles.legalLinks}>
            <Text
              style={[styles.legalLink, { color: theme.accent }]}
              onPress={onRestore}
            >
              {restoring ? 'Restoring…' : 'Restore purchases'}
            </Text>
            <Text style={[styles.legalDot, { color: theme.textFaint }]}>·</Text>
            <Text
              style={[styles.legalLink, { color: theme.accent }]}
              onPress={() => Linking.openURL(TERMS_URL)}
            >
              Terms of Use (EULA)
            </Text>
            <Text style={[styles.legalDot, { color: theme.textFaint }]}>·</Text>
            <Text
              style={[styles.legalLink, { color: theme.accent }]}
              onPress={() => Linking.openURL(privacyUrl)}
            >
              Privacy Policy
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 24, paddingTop: 20, paddingBottom: 40 },
  close: { alignSelf: 'flex-end', padding: 4 },
  closeText: { fontSize: 22 },
  title: {
    fontSize: 28,
    fontWeight: fonts.weight.bold,
    letterSpacing: -0.5,
    marginTop: 8,
  },
  subtitle: { fontSize: 16, lineHeight: 23, marginTop: 8, marginBottom: 24 },
  features: { gap: 16, marginBottom: 28 },
  feature: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  featureIcon: { fontSize: 22 },
  featureTitle: { fontSize: 16, fontWeight: fonts.weight.semibold },
  featureSub: { fontSize: 14, lineHeight: 20, marginTop: 2 },
  packages: { gap: 12 },
  pkg: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 16,
  },
  pkgTitle: { fontSize: 16, fontWeight: fonts.weight.semibold },
  pkgBadge: { fontSize: 12, fontWeight: fonts.weight.semibold, marginTop: 2 },
  pkgPrice: { fontSize: 17, fontWeight: fonts.weight.bold },
  unavailable: { textAlign: 'center', marginVertical: 24, fontSize: 15 },
  noPayment: { fontSize: 13, textAlign: 'center', fontWeight: fonts.weight.semibold },
  legal: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 26,
    gap: 6,
  },
  legalText: { fontSize: 11, lineHeight: 15, textAlign: 'center' },
  legalLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  legalLink: {
    fontSize: 12,
    fontWeight: fonts.weight.semibold,
    textDecorationLine: 'underline',
  },
  legalDot: { fontSize: 12 },
});
