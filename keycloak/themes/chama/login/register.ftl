<#--
  Chama override of the base Keycloak register.ftl. The stock version sets displayRequiredFields=true
  (a right-aligned "* Required fields" legend in a Bootstrap grid), orders fields
  username/email/firstName/lastName, and renders password/password-confirm with a Font Awesome eye icon
  that this theme never loads (login.css only imports PatternFly), so the toggle button rendered empty.

  This override hardcodes the field set instead of going through userProfileCommons.userProfileFormFields:
  firstName, lastName, email, password, confirm password, no separate username. The realm has
  registrationEmailAsUsername=true (see realm-chama.json), matching how KeycloakAdminService already
  provisions members with username set to their email, so there's nothing for a self-registering member
  to pick. Every field still POSTs under the name RegistrationUserCreation expects (email, firstName,
  lastName, password, password-confirm), so server-side validation and messagesPerField errors work the
  same as the stock form, only the layout is hand-built.
-->
<#import "template.ftl" as layout>
<#import "register-commons.ftl" as registerCommons>
<@layout.registrationLayout displayMessage=messagesPerField.exists('global') displayRequiredFields=false; section>
    <#if section = "header">
        ${msg("registerTitle")}
    <#elseif section = "form">
        <p class="chama-card-sub">Create an account to join or manage a chama.</p>
        <form id="kc-register-form" class="chama-form" action="${url.registrationAction}" method="post">

            <div class="chama-field">
                <label for="firstName" class="chama-label">${msg("firstName")}</label>
                <input type="text" id="firstName" class="pf-c-form-control" name="firstName"
                       value="${(register.formData.firstName)!''}" autocomplete="given-name"
                       aria-invalid="<#if messagesPerField.existsError('firstName')>true</#if>"
                />
                <#if messagesPerField.existsError('firstName')>
                    <span id="input-error-firstname" class="chama-input-error" aria-live="polite">
                            ${kcSanitize(messagesPerField.get('firstName'))?no_esc}
                    </span>
                </#if>
            </div>

            <div class="chama-field">
                <label for="lastName" class="chama-label">${msg("lastName")}</label>
                <input type="text" id="lastName" class="pf-c-form-control" name="lastName"
                       value="${(register.formData.lastName)!''}" autocomplete="family-name"
                       aria-invalid="<#if messagesPerField.existsError('lastName')>true</#if>"
                />
                <#if messagesPerField.existsError('lastName')>
                    <span id="input-error-lastname" class="chama-input-error" aria-live="polite">
                            ${kcSanitize(messagesPerField.get('lastName'))?no_esc}
                    </span>
                </#if>
            </div>

            <div class="chama-field">
                <label for="email" class="chama-label">${msg("email")}</label>
                <input type="text" id="email" class="pf-c-form-control" name="email"
                       value="${(register.formData.email)!''}" autocomplete="email"
                       aria-invalid="<#if messagesPerField.existsError('email')>true</#if>"
                />
                <#if messagesPerField.existsError('email')>
                    <span id="input-error-email" class="chama-input-error" aria-live="polite">
                            ${kcSanitize(messagesPerField.get('email'))?no_esc}
                    </span>
                </#if>
            </div>

            <div class="chama-field">
                <label for="password" class="chama-label">${msg("password")}</label>
                <div class="chama-pwd-wrapper">
                    <input type="password" id="password" class="pf-c-form-control" name="password"
                           autocomplete="new-password"
                           aria-invalid="<#if messagesPerField.existsError('password','password-confirm')>true</#if>"
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
                <#if messagesPerField.existsError('password')>
                    <span id="input-error-password" class="chama-input-error" aria-live="polite">
                            ${kcSanitize(messagesPerField.get('password'))?no_esc}
                    </span>
                </#if>
            </div>

            <div class="chama-field">
                <label for="password-confirm" class="chama-label">${msg("passwordConfirm")}</label>
                <div class="chama-pwd-wrapper">
                    <input type="password" id="password-confirm" class="pf-c-form-control"
                           name="password-confirm"
                           aria-invalid="<#if messagesPerField.existsError('password-confirm')>true</#if>"
                    />
                    <button type="button" class="chama-pwd-toggle" data-password-toggle aria-controls="password-confirm"
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
                <#if messagesPerField.existsError('password-confirm')>
                    <span id="input-error-password-confirm" class="chama-input-error" aria-live="polite">
                            ${kcSanitize(messagesPerField.get('password-confirm'))?no_esc}
                    </span>
                </#if>
            </div>

            <@registerCommons.termsAcceptance/>

            <#if recaptchaRequired??>
                <div class="chama-field">
                    <div class="g-recaptcha" data-size="compact" data-sitekey="${recaptchaSiteKey}"></div>
                </div>
            </#if>

            <div class="chama-form-options" style="clear: both;">
                <span><a href="${url.loginUrl}">${kcSanitize(msg("backToLogin"))?no_esc}</a></span>
            </div>

            <button class="pf-c-button pf-m-primary pf-m-block chama-btn-submit" type="submit">${msg("doRegister")}</button>
        </form>
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
    </#if>
</@layout.registrationLayout>
