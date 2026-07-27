<#--
  Chama override of the base Keycloak login.ftl. Hand-built form markup (custom eye-icon password
  toggle, custom field/error structure) matching DondooHomes' login card, instead of the stock
  PatternFly form-control classes. Still uses template.ftl's registrationLayout macro for the
  two-panel shell, header, alert, try-another-way, and social-provider wiring.
-->
<#import "template.ftl" as layout>
<@layout.registrationLayout displayMessage=!messagesPerField.existsError('username','password') displayInfo=realm.password && realm.registrationAllowed && !registrationDisabled??; section>
    <#if section = "header">
        ${msg("loginAccountTitle")}
    <#elseif section = "form">
        <p class="chama-card-sub">Sign in to manage your chama's contributions and payouts.</p>
        <div id="kc-form">
          <div id="kc-form-wrapper">
            <#if realm.password>
                <form id="kc-form-login" onsubmit="login.disabled = true; return true;" class="chama-form" action="${url.loginAction}" method="post">
                    <#if !usernameHidden??>
                        <div class="chama-field">
                            <label for="username" class="chama-label"><#if !realm.loginWithEmailAllowed>${msg("username")}<#elseif !realm.registrationEmailAsUsername>${msg("usernameOrEmail")}<#else>${msg("email")}</#if></label>
                            <input tabindex="2" id="username" class="pf-c-form-control" name="username" value="${(login.username!'')}" type="text" autofocus autocomplete="username"
                                   aria-invalid="<#if messagesPerField.existsError('username','password')>true</#if>"
                            />
                            <#if messagesPerField.existsError('username','password')>
                                <div id="input-error" class="chama-alert chama-alert-danger" role="alert" aria-live="polite">
                                    <svg class="chama-alert-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                                        <path d="M10 2 1.5 17h17L10 2Z" stroke-linejoin="round" />
                                        <path d="M10 8v4" stroke-linecap="round" />
                                        <circle cx="10" cy="14.5" r="0.75" fill="currentColor" stroke="none" />
                                    </svg>
                                    <span>${kcSanitize(messagesPerField.getFirstError('username','password'))?no_esc}</span>
                                </div>
                            </#if>
                        </div>
                    </#if>

                    <div class="chama-field">
                        <label for="password" class="chama-label">${msg("password")}</label>
                        <div class="chama-pwd-wrapper">
                            <input tabindex="3" id="password" class="pf-c-form-control" name="password" type="password" autocomplete="current-password"
                                   aria-invalid="<#if messagesPerField.existsError('username','password')>true</#if>"
                            />
                            <button type="button" class="chama-pwd-toggle" data-password-toggle aria-controls="password"
                                    data-label-show="${msg('showPassword')}" data-label-hide="${msg('hidePassword')}"
                                    aria-label="${msg('showPassword')}">
                                <svg class="chama-eye-show" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                                    <path d="M1 10s3-6 9-6 9 6 9 6-3 6-9 6-9-6-9-6Z" stroke-linejoin="round" />
                                    <circle cx="10" cy="10" r="2.5" />
                                </svg>
                                <svg class="chama-eye-hide" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true" hidden>
                                    <path d="M2 2l16 16M8.3 8.6a2.5 2.5 0 0 0 3.3 3.3M6 6.3C3.6 7.7 2 10 2 10s3 6 9 6c1.3 0 2.5-.3 3.6-.7M12.2 5.2c2.7.9 4.8 4.8 4.8 4.8s-.6 1.3-1.8 2.6" stroke-linecap="round" stroke-linejoin="round" />
                                </svg>
                            </button>
                        </div>
                        <#if usernameHidden?? && messagesPerField.existsError('username','password')>
                            <div id="input-error" class="chama-alert chama-alert-danger" role="alert" aria-live="polite">
                                <svg class="chama-alert-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                                    <path d="M10 2 1.5 17h17L10 2Z" stroke-linejoin="round" />
                                    <path d="M10 8v4" stroke-linecap="round" />
                                    <circle cx="10" cy="14.5" r="0.75" fill="currentColor" stroke="none" />
                                </svg>
                                <span>${kcSanitize(messagesPerField.getFirstError('username','password'))?no_esc}</span>
                            </div>
                        </#if>
                    </div>

                    <div class="chama-form-options">
                        <#if realm.rememberMe && !usernameHidden??>
                            <label class="chama-checkbox">
                                <#if login.rememberMe??>
                                    <input tabindex="5" id="rememberMe" name="rememberMe" type="checkbox" checked>
                                <#else>
                                    <input tabindex="5" id="rememberMe" name="rememberMe" type="checkbox">
                                </#if>
                                ${msg("rememberMe")}
                            </label>
                        </#if>
                        <#if realm.resetPasswordAllowed>
                            <a tabindex="6" class="chama-forgot" href="${url.loginResetCredentialsUrl}">${msg("doForgotPassword")}</a>
                        </#if>
                    </div>

                    <input type="hidden" id="id-hidden-input" name="credentialId" <#if auth.selectedCredential?has_content>value="${auth.selectedCredential}"</#if>/>
                    <button tabindex="7" class="pf-c-button pf-m-primary pf-m-block chama-btn-submit" name="login" id="kc-login" type="submit">${msg("doLogIn")}</button>
                </form>
            </#if>
          </div>
        </div>
        <script type="module">
            document.querySelectorAll('[data-password-toggle]').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    var input = document.getElementById(btn.getAttribute('aria-controls'));
                    var showing = input.type === 'text';
                    input.type = showing ? 'password' : 'text';
                    btn.querySelector('.chama-eye-show').hidden = !showing;
                    btn.querySelector('.chama-eye-hide').hidden = showing;
                    btn.setAttribute('aria-label', showing ? btn.getAttribute('data-label-show') : btn.getAttribute('data-label-hide'));
                });
            });
        </script>
    <#elseif section = "info" >
        <#if realm.password && realm.registrationAllowed && !registrationDisabled??>
            <div id="kc-registration-container">
                <div id="kc-registration">
                    <span>${msg("noAccount")} <a tabindex="8"
                                                 href="${url.registrationUrl}">${msg("doRegister")}</a></span>
                </div>
            </div>
        </#if>
    <#elseif section = "socialProviders" >
        <#if realm.password && social.providers??>
            <div id="kc-social-providers" class="${properties.kcFormSocialAccountSectionClass!}">
                <hr/>
                <h2>${msg("identity-provider-login-label")}</h2>

                <ul class="${properties.kcFormSocialAccountListClass!} <#if social.providers?size gt 3>${properties.kcFormSocialAccountListGridClass!}</#if>">
                    <#list social.providers as p>
                        <li>
                            <a id="social-${p.alias}" class="${properties.kcFormSocialAccountListButtonClass!} <#if social.providers?size gt 3>${properties.kcFormSocialAccountGridItem!}</#if>"
                                    type="button" href="${p.loginUrl}">
                                <#if p.iconClasses?has_content>
                                    <i class="${properties.kcCommonLogoIdP!} ${p.iconClasses!}" aria-hidden="true"></i>
                                    <span class="${properties.kcFormSocialAccountNameClass!} kc-social-icon-text">${p.displayName!}</span>
                                <#else>
                                    <span class="${properties.kcFormSocialAccountNameClass!}">${p.displayName!}</span>
                                </#if>
                            </a>
                        </li>
                    </#list>
                </ul>
            </div>
        </#if>
    </#if>

</@layout.registrationLayout>
